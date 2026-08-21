import assert from "node:assert/strict";
import test from "node:test";
import {
  createDeckHandler,
  type DeckHandlerDependencies,
} from "../netlify/functions/decks.ts";

function createDependencies(): DeckHandlerDependencies {
  return {
    authenticate: async () => ({ uid: "account-1" }),
    authorizeWorkspace: async () => ({ role: "founder" }),
    createDeck: async () => {
      throw new Error("Unexpected deck creation.");
    },
    duplicateDeck: async () => {
      throw new Error("Unexpected deck duplication.");
    },
    getDeck: async () => null,
    listDecks: async () => [],
    updateDeck: async () => {
      throw new Error("Unexpected deck update.");
    },
  };
}

test("rejects deck requests without authentication", async () => {
  const handler = createDeckHandler(createDependencies());
  const response = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/decks"),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Authentication required.",
  });
});

test("lists decks for an authorized workspace member", async () => {
  const dependencies = createDependencies();
  dependencies.listDecks = async (_account, workspaceId) => {
    assert.equal(workspaceId, "workspace-1");
    return [
      {
        id: "deck-1",
        name: "Autumn campaign",
        publicationStatus: "draft",
        defaultDisplayDurationSeconds: 15,
        slideCount: 0,
        version: 1,
      },
    ];
  };
  const handler = createDeckHandler(dependencies);
  const response = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/decks", {
      headers: { authorization: "Bearer valid-token" },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    decks: [
      {
        id: "deck-1",
        name: "Autumn campaign",
        publicationStatus: "draft",
        defaultDisplayDurationSeconds: 15,
        slideCount: 0,
        version: 1,
      },
    ],
  });
});

test("denies deck access outside the account workspace", async () => {
  const dependencies = createDependencies();
  dependencies.authorizeWorkspace = async () => null;
  const handler = createDeckHandler(dependencies);
  const response = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/decks", {
      headers: { authorization: "Bearer valid-token" },
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Workspace access denied." });
});

test("creates a draft deck for a workspace editor", async () => {
  const dependencies = createDependencies();
  dependencies.authorizeWorkspace = async () => ({ role: "editor" });
  dependencies.createDeck = async (_account, workspaceId, requestedName) => {
    assert.equal(workspaceId, "workspace-1");
    assert.equal(requestedName, "Autumn campaign");
    return {
      kind: "created",
      deck: {
        id: "deck-1",
        name: "Autumn campaign",
        publicationStatus: "draft",
        defaultDisplayDurationSeconds: 15,
        slideCount: 0,
        version: 1,
      },
    };
  };
  const handler = createDeckHandler(dependencies);
  const response = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/decks", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Autumn campaign" }),
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    deck: {
      id: "deck-1",
      name: "Autumn campaign",
      publicationStatus: "draft",
      defaultDisplayDurationSeconds: 15,
      slideCount: 0,
      version: 1,
    },
  });
});

test("allows viewers to list decks but not create them", async () => {
  const dependencies = createDependencies();
  dependencies.authorizeWorkspace = async () => ({ role: "viewer" });
  const handler = createDeckHandler(dependencies);
  const response = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/decks", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Viewer deck" }),
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Editing access required." });

  const updateResponse = await handler(
    new Request(
      "https://qrousel.test/api/workspaces/workspace-1/decks/deck-1",
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Viewer edit",
          defaultDisplayDurationSeconds: 20,
          expectedVersion: 1,
        }),
      },
    ),
  );
  assert.equal(updateResponse.status, 403);
  assert.deepEqual(await updateResponse.json(), {
    error: "Editing access required.",
  });
});

test("reports the deck limit and rejects an empty name", async () => {
  const dependencies = createDependencies();
  dependencies.createDeck = async () => ({ kind: "limit", limit: 100 });
  const handler = createDeckHandler(dependencies);

  const limitResponse = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/decks", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "One too many" }),
    }),
  );
  assert.equal(limitResponse.status, 409);
  assert.deepEqual(await limitResponse.json(), {
    status: "limit_reached",
    limit: 100,
  });

  const invalidResponse = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/decks", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "  " }),
    }),
  );
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), {
    error: "A deck name is required.",
  });
});

test("loads one deck for the editor route", async () => {
  const dependencies = createDependencies();
  dependencies.getDeck = async (_account, workspaceId, deckId) => {
    assert.equal(workspaceId, "workspace-1");
    assert.equal(deckId, "deck-1");
    return {
      id: "deck-1",
      name: "Autumn campaign",
      publicationStatus: "draft",
      defaultDisplayDurationSeconds: 15,
      slideCount: 0,
      version: 1,
    };
  };
  const handler = createDeckHandler(dependencies);
  const response = await handler(
    new Request(
      "https://qrousel.test/api/workspaces/workspace-1/decks/deck-1",
      { headers: { authorization: "Bearer valid-token" } },
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    deck: {
      id: "deck-1",
      name: "Autumn campaign",
      publicationStatus: "draft",
      defaultDisplayDurationSeconds: 15,
      slideCount: 0,
      version: 1,
    },
  });
});

test("updates deck settings for an editor with the expected version", async () => {
  const dependencies = createDependencies();
  dependencies.authorizeWorkspace = async () => ({ role: "editor" });
  dependencies.updateDeck = async (_account, workspaceId, deckId, input) => {
    assert.equal(workspaceId, "workspace-1");
    assert.equal(deckId, "deck-1");
    assert.deepEqual(input, {
      name: "Visitor welcome",
      defaultDisplayDurationSeconds: 24,
      expectedVersion: 2,
    });
    return {
      kind: "updated",
      deck: {
        id: "deck-1",
        name: "Visitor welcome",
        publicationStatus: "draft",
        defaultDisplayDurationSeconds: 24,
        slideCount: 0,
        version: 3,
      },
    };
  };
  const handler = createDeckHandler(dependencies);
  const response = await handler(
    new Request(
      "https://qrousel.test/api/workspaces/workspace-1/decks/deck-1",
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Visitor welcome",
          defaultDisplayDurationSeconds: 24,
          expectedVersion: 2,
        }),
      },
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    deck: {
      id: "deck-1",
      name: "Visitor welcome",
      publicationStatus: "draft",
      defaultDisplayDurationSeconds: 24,
      slideCount: 0,
      version: 3,
    },
  });
});

test("returns the current deck when an editor saves a stale version", async () => {
  const dependencies = createDependencies();
  dependencies.updateDeck = async () => ({
    kind: "conflict",
    deck: {
      id: "deck-1",
      name: "Changed elsewhere",
      publicationStatus: "draft",
      defaultDisplayDurationSeconds: 20,
      slideCount: 0,
      version: 4,
    },
  });
  const handler = createDeckHandler(dependencies);
  const response = await handler(
    new Request(
      "https://qrousel.test/api/workspaces/workspace-1/decks/deck-1",
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "My stale change",
          defaultDisplayDurationSeconds: 18,
          expectedVersion: 3,
        }),
      },
    ),
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    status: "conflict",
    deck: {
      id: "deck-1",
      name: "Changed elsewhere",
      publicationStatus: "draft",
      defaultDisplayDurationSeconds: 20,
      slideCount: 0,
      version: 4,
    },
  });
});

test("duplicates a deck with the editor's selected copy settings", async () => {
  const dependencies = createDependencies();
  dependencies.authorizeWorkspace = async () => ({ role: "editor" });
  dependencies.duplicateDeck = async (
    _account,
    workspaceId,
    sourceDeckId,
    input,
  ) => {
    assert.equal(workspaceId, "workspace-1");
    assert.equal(sourceDeckId, "deck-1");
    assert.deepEqual(input, {
      name: "Visitor welcome",
      defaultDisplayDurationSeconds: 24,
    });
    return {
      kind: "duplicated",
      deck: {
        id: "deck-copy",
        name: "Visitor welcome",
        publicationStatus: "draft",
        defaultDisplayDurationSeconds: 24,
        slideCount: 0,
        version: 1,
      },
    };
  };
  const handler = createDeckHandler(dependencies);
  const response = await handler(
    new Request(
      "https://qrousel.test/api/workspaces/workspace-1/decks/deck-1/duplicate",
      {
        method: "POST",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Visitor welcome",
          defaultDisplayDurationSeconds: 24,
        }),
      },
    ),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    deck: {
      id: "deck-copy",
      name: "Visitor welcome",
      publicationStatus: "draft",
      defaultDisplayDurationSeconds: 24,
      slideCount: 0,
      version: 1,
    },
  });
});
