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
    listDecks: async () => [],
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
