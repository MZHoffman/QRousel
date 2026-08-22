import assert from "node:assert/strict";
import test from "node:test";
import {
  createSlideHandler,
  type SlideHandlerDependencies,
} from "../netlify/functions/slides.ts";

function createDependencies(): SlideHandlerDependencies {
  return {
    authenticate: async () => ({ uid: "account-1" }),
    authorizeWorkspace: async () => ({ role: "founder" }),
    createSlide: async () => {
      throw new Error("Unexpected slide creation.");
    },
    listSlides: async () => [],
    updateSlide: async () => {
      throw new Error("Unexpected slide update.");
    },
  };
}

test("lists reusable slides for an authorized workspace member", async () => {
  const dependencies = createDependencies();
  dependencies.listSlides = async (_account, workspaceId) => {
    assert.equal(workspaceId, "workspace-1");
    return [
      {
        id: "slide-1",
        title: "Visitor welcome",
        description: "Scan to join the event.",
        version: 1,
      },
    ];
  };
  const handler = createSlideHandler(dependencies);

  const response = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/slides", {
      headers: { authorization: "Bearer valid-token" },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    slides: [
      {
        id: "slide-1",
        title: "Visitor welcome",
        description: "Scan to join the event.",
        version: 1,
      },
    ],
  });
});

test("creates a reusable slide for an editor", async () => {
  const dependencies = createDependencies();
  dependencies.authorizeWorkspace = async () => ({ role: "editor" });
  dependencies.createSlide = async (_account, workspaceId, input) => {
    assert.equal(workspaceId, "workspace-1");
    assert.deepEqual(input, {
      title: "Visitor welcome",
      description: "Scan to join the event.",
    });
    return {
      kind: "created",
      slide: {
        id: "slide-1",
        title: input.title,
        description: input.description,
        version: 1,
      },
    };
  };
  const handler = createSlideHandler(dependencies);

  const response = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/slides", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Visitor welcome",
        description: "Scan to join the event.",
      }),
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    slide: {
      id: "slide-1",
      title: "Visitor welcome",
      description: "Scan to join the event.",
      version: 1,
    },
  });
});

test("lets viewers read slides but prevents them from editing", async () => {
  const dependencies = createDependencies();
  dependencies.authorizeWorkspace = async () => ({ role: "viewer" });
  const handler = createSlideHandler(dependencies);

  const response = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/slides", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Visitor welcome", description: "Scan" }),
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Editing access required." });
});

test("returns a conflict with the latest slide when another editor saves first", async () => {
  const dependencies = createDependencies();
  dependencies.updateSlide = async () => ({
    kind: "conflict",
    slide: {
      id: "slide-1",
      title: "Latest title",
      description: "Latest description",
      version: 2,
    },
  });
  const handler = createSlideHandler(dependencies);

  const response = await handler(
    new Request(
      "https://qrousel.test/api/workspaces/workspace-1/slides/slide-1",
      {
        method: "PATCH",
        headers: {
          authorization: "Bearer valid-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "My title",
          description: "My description",
          expectedVersion: 1,
        }),
      },
    ),
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    status: "conflict",
    slide: {
      id: "slide-1",
      title: "Latest title",
      description: "Latest description",
      version: 2,
    },
  });
});
