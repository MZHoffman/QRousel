import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveWorkspaceDeckId,
  workspaceDeckPath,
} from "../lib/decks/navigation.ts";
import { workspaceLandingPath } from "../lib/workspaces/navigation.ts";

test("builds and resolves a workspace-scoped deck editor path", () => {
  const path = workspaceDeckPath("workspace/one", "deck/one");
  assert.equal(
    path,
    "/app/workspaces/workspace%2Fone/decks/deck%2Fone",
  );
  assert.equal(resolveWorkspaceDeckId(path, "workspace/one"), "deck/one");
  assert.equal(resolveWorkspaceDeckId(path, "another-workspace"), null);
});

test("preserves a valid deck editor deep link on refresh", () => {
  const path = "/app/workspaces/workspace-1/decks/deck-1";
  assert.equal(workspaceLandingPath("workspace-1", path), path);
});
