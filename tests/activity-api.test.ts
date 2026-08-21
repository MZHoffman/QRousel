import assert from "node:assert/strict";
import test from "node:test";
import {
  createActivityHandler,
  type ActivityHandlerDependencies,
} from "../netlify/functions/activity.ts";

function createDependencies(): ActivityHandlerDependencies {
  return {
    authenticate: async () => ({ uid: "account-1" }),
    authorizeWorkspace: async () => ({ role: "viewer" }),
    listActivity: async () => ({ activity: [], nextCursor: null }),
  };
}

test("lets an authenticated viewer read workspace activity", async () => {
  const dependencies = createDependencies();
  dependencies.listActivity = async (workspaceId, cursor) => {
    assert.equal(workspaceId, "workspace-1");
    assert.equal(cursor, null);
    return {
      activity: [
        {
          id: "activity-1",
          type: "deck.created",
          actorUid: "account-1",
          actorName: "Michał Hoffman",
          occurredAt: "2026-08-22T08:15:00.000Z",
          resourceId: "deck-1",
          resourceName: "Visitor welcome",
          resourceType: "deck",
        },
      ],
      nextCursor: "next-page",
    };
  };
  const handler = createActivityHandler(dependencies);
  const response = await handler(
    new Request(
      "https://qrousel.test/api/workspaces/workspace-1/activity",
      { headers: { authorization: "Bearer valid-token" } },
    ),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    activity: [
      {
        id: "activity-1",
        type: "deck.created",
        actorUid: "account-1",
        actorName: "Michał Hoffman",
        occurredAt: "2026-08-22T08:15:00.000Z",
        resourceId: "deck-1",
        resourceName: "Visitor welcome",
        resourceType: "deck",
      },
    ],
    nextCursor: "next-page",
  });
});

test("passes an opaque cursor to the next activity page", async () => {
  const dependencies = createDependencies();
  dependencies.listActivity = async (_workspaceId, cursor) => {
    assert.equal(cursor, "older-page");
    return { activity: [], nextCursor: null };
  };
  const response = await createActivityHandler(dependencies)(
    new Request(
      "https://qrousel.test/api/workspaces/workspace-1/activity?cursor=older-page",
      { headers: { authorization: "Bearer valid-token" } },
    ),
  );
  assert.deepEqual(await response.json(), { activity: [], nextCursor: null });
});

test("keeps workspace activity private from unauthenticated users and non-members", async () => {
  const handler = createActivityHandler(createDependencies());
  const unauthenticatedResponse = await handler(
    new Request("https://qrousel.test/api/workspaces/workspace-1/activity"),
  );
  assert.equal(unauthenticatedResponse.status, 401);
  assert.deepEqual(await unauthenticatedResponse.json(), {
    error: "Authentication required.",
  });

  const dependencies = createDependencies();
  dependencies.authorizeWorkspace = async () => null;
  const forbiddenResponse = await createActivityHandler(dependencies)(
    new Request("https://qrousel.test/api/workspaces/workspace-1/activity", {
      headers: { authorization: "Bearer valid-token" },
    }),
  );
  assert.equal(forbiddenResponse.status, 403);
  assert.deepEqual(await forbiddenResponse.json(), {
    error: "Workspace access denied.",
  });
});
