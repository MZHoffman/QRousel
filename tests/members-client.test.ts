import assert from "node:assert/strict";
import test from "node:test";
import { requestMembers } from "../src/workspaces/members-client.ts";

test("shows the member API's specific error instead of a generic failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(
    { error: "Method not allowed." },
    { status: 405 },
  );

  try {
    await assert.rejects(
      () => requestMembers({ getIdToken: async () => "test-token" } as never, "workspace-1"),
      /Method not allowed\./,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
