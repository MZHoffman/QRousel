import assert from "node:assert/strict";
import test from "node:test";
import { requestWorkspaceActivity } from "../src/activity/activity-client.ts";

test("requests the authenticated workspace activity feed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(input, "/api/workspaces/workspace-1/activity?cursor=older-page");
    assert.deepEqual(init?.headers, {
      authorization: "Bearer test-token",
    });
    return Response.json({ activity: [], nextCursor: null });
  };

  try {
    assert.deepEqual(
      await requestWorkspaceActivity(
        { getIdToken: async () => "test-token" },
        "workspace-1",
        "older-page",
      ),
      { activity: [], nextCursor: null },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
