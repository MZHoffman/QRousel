import assert from "node:assert/strict";
import test from "node:test";
import {
  createWorkspaceHandler,
  type WorkspaceHandlerDependencies,
} from "../netlify/functions/workspaces.ts";

function createDependencies(): WorkspaceHandlerDependencies {
  return {
    authenticate: async () => ({ uid: "account-1" }),
    createWorkspace: async () => {
      throw new Error("Unexpected workspace creation.");
    },
    listWorkspaces: async () => [],
  };
}

test("rejects workspace requests without authentication", async () => {
  const handler = createWorkspaceHandler(createDependencies());
  const response = await handler(new Request("https://qrousel.test/api/workspaces"));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Authentication required.",
  });
});

test("creates a Founder workspace for the authenticated account", async () => {
  const dependencies = createDependencies();
  dependencies.createWorkspace = async () => ({
    kind: "created",
    workspace: {
      id: "workspace-1",
      name: "Hoffman Studio",
      role: "founder",
    },
  });
  const handler = createWorkspaceHandler(dependencies);
  const response = await handler(
    new Request("https://qrousel.test/api/workspaces", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Hoffman Studio" }),
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    workspace: {
      id: "workspace-1",
      name: "Hoffman Studio",
      role: "founder",
    },
  });
});

test("reports the workspace creation limit without creating a workspace", async () => {
  const dependencies = createDependencies();
  dependencies.createWorkspace = async () => ({ kind: "limit", limit: 5 });
  const handler = createWorkspaceHandler(dependencies);
  const response = await handler(
    new Request("https://qrousel.test/api/workspaces", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Sixth workspace" }),
    }),
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    status: "limit_reached",
    limit: 5,
  });
});

test("rejects a blank workspace name before calling the service", async () => {
  const handler = createWorkspaceHandler(createDependencies());
  const response = await handler(
    new Request("https://qrousel.test/api/workspaces", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "   " }),
    }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "A workspace name is required.",
  });
});

test("lists workspaces for the authenticated account", async () => {
  const dependencies = createDependencies();
  dependencies.listWorkspaces = async () => [
    { id: "workspace-1", name: "Hoffman Studio", role: "founder" },
  ];
  const handler = createWorkspaceHandler(dependencies);
  const response = await handler(
    new Request("https://qrousel.test/api/workspaces", {
      headers: { authorization: "Bearer valid-token" },
    }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    workspaces: [
      { id: "workspace-1", name: "Hoffman Studio", role: "founder" },
    ],
  });
});
