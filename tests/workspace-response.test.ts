import assert from "node:assert/strict";
import test from "node:test";
import {
  isWorkspaceCreationResponse,
  isWorkspaceListResponse,
  isWorkspaceLimitResponse,
} from "../lib/workspaces/api-response.ts";

const founderWorkspace = {
  id: "workspace-1",
  name: "Hoffman Studio",
  role: "founder",
};

test("accepts workspace list and creation responses", () => {
  assert.equal(
    isWorkspaceListResponse({ workspaces: [founderWorkspace] }),
    true,
  );
  assert.equal(
    isWorkspaceCreationResponse({ workspace: founderWorkspace }),
    true,
  );
});

test("accepts the workspace limit response", () => {
  assert.equal(
    isWorkspaceLimitResponse({ status: "limit_reached", limit: 5 }),
    true,
  );
});

test("rejects malformed workspace responses", () => {
  assert.equal(
    isWorkspaceListResponse({
      workspaces: [{ ...founderWorkspace, role: "superuser" }],
    }),
    false,
  );
  assert.equal(
    isWorkspaceCreationResponse({ workspace: { name: "Missing ID" } }),
    false,
  );
  assert.equal(
    isWorkspaceLimitResponse({ status: "limit_reached", limit: "5" }),
    false,
  );
});
