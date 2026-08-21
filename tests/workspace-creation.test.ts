import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKSPACE_CREATION_LIMIT,
  decideWorkspaceCreation,
} from "../lib/workspaces/creation.ts";

test("prepares a trimmed workspace name below the creation limit", () => {
  assert.deepEqual(
    decideWorkspaceCreation({
      createdWorkspaceCount: 2,
      requestedName: "  Hoffman Studio  ",
    }),
    {
      kind: "create",
      name: "Hoffman Studio",
      nextCreatedWorkspaceCount: 3,
    },
  );
});

test("stops workspace creation at the account limit", () => {
  assert.deepEqual(
    decideWorkspaceCreation({
      createdWorkspaceCount: WORKSPACE_CREATION_LIMIT,
      requestedName: "Another workspace",
    }),
    {
      kind: "limit",
      limit: WORKSPACE_CREATION_LIMIT,
    },
  );
});

test("rejects an empty workspace name", () => {
  assert.throws(
    () =>
      decideWorkspaceCreation({
        createdWorkspaceCount: 0,
        requestedName: "   ",
      }),
    /name is required/,
  );
});

test("fails closed when the workspace counter is invalid", () => {
  assert.throws(
    () =>
      decideWorkspaceCreation({
        createdWorkspaceCount: -1,
        requestedName: "Studio",
      }),
    /counter is invalid/,
  );
});
