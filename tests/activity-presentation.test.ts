import assert from "node:assert/strict";
import test from "node:test";
import type {
  WorkspaceActivityEntry,
  WorkspaceActivityType,
} from "../lib/activity/api-response.ts";
import { describeWorkspaceActivity } from "../lib/activity/presentation.ts";

function entry(
  type: WorkspaceActivityType,
  resourceName: string | null,
): WorkspaceActivityEntry {
  return {
    id: `activity-${type}`,
    type,
    actorUid: "account-1",
    actorName: "Michał Hoffman",
    occurredAt: "2026-08-22T08:15:00.000Z",
    resourceId: "resource-1",
    resourceName,
    resourceType: type === "workspace.created" ? "workspace" : "deck",
  };
}

test("describes every supported workspace activity event", () => {
  assert.deepEqual(
    [
      entry("workspace.created", null),
      entry("deck.created", "Visitor welcome"),
      entry("deck.updated", "Visitor welcome"),
      entry("deck.duplicated", "Visitor welcome copy"),
    ].map(describeWorkspaceActivity),
    [
      {
        title: "Workspace created",
        detail: "Michał Hoffman created this workspace.",
      },
      {
        title: "Deck created",
        detail: "Michał Hoffman created “Visitor welcome”.",
      },
      {
        title: "Deck updated",
        detail: "Michał Hoffman updated “Visitor welcome”.",
      },
      {
        title: "Deck duplicated",
        detail: "Michał Hoffman created the copy “Visitor welcome copy”.",
      },
    ],
  );
});
