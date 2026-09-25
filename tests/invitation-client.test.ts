import assert from "node:assert/strict";
import test from "node:test";
import { requestInvitations } from "../src/workspaces/invitation-client.ts";

test("shows the invitation API's specific error instead of a generic failure", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json(
    { error: "Only workspace administrators can view invitations." },
    { status: 403 },
  );

  try {
    await assert.rejects(
      () => requestInvitations({ getIdToken: async () => "test-token" } as never, "workspace-1"),
      /Only workspace administrators can view invitations\./,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
