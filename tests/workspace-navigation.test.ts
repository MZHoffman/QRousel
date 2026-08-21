import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKSPACE_NAVIGATION,
  resolveWorkspaceSection,
  workspaceLandingPath,
  workspaceSectionPath,
} from "../lib/workspaces/navigation.ts";

test("exposes the complete workspace navigation in product order", () => {
  assert.deepEqual(
    WORKSPACE_NAVIGATION.map(({ id, label }) => ({ id, label })),
    [
      { id: "overview", label: "Overview" },
      { id: "decks", label: "Decks" },
      { id: "slides", label: "Slides" },
      { id: "qr-codes", label: "QR codes" },
      { id: "icons", label: "Icons" },
      { id: "members", label: "Members" },
      { id: "activity", label: "Activity" },
      { id: "trash", label: "Trash" },
    ],
  );
});

test("builds workspace-scoped paths for every destination", () => {
  assert.equal(
    workspaceSectionPath("workspace/one", "overview"),
    "/app/workspaces/workspace%2Fone",
  );
  assert.equal(
    workspaceSectionPath("workspace/one", "qr-codes"),
    "/app/workspaces/workspace%2Fone/qr-codes",
  );
});

test("resolves known workspace routes and safely falls back to overview", () => {
  assert.equal(
    resolveWorkspaceSection("/app/workspaces/workspace-1/slides"),
    "slides",
  );
  assert.equal(
    resolveWorkspaceSection("/app/workspaces/workspace-1/not-a-section"),
    "overview",
  );
  assert.equal(resolveWorkspaceSection("/app"), "overview");
});

test("preserves a valid deep link only for the selected workspace", () => {
  assert.equal(
    workspaceLandingPath(
      "workspace-1",
      "/app/workspaces/workspace-1/activity",
    ),
    "/app/workspaces/workspace-1/activity",
  );
  assert.equal(
    workspaceLandingPath(
      "workspace-1",
      "/app/workspaces/workspace-2/activity",
    ),
    "/app/workspaces/workspace-1",
  );
});
