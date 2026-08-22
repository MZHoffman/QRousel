import assert from "node:assert/strict";
import test from "node:test";
import { isActivityListResponse } from "../lib/activity/api-response.ts";

test("accepts a workspace activity feed with actor and resource details", () => {
  assert.equal(
    isActivityListResponse({
      activity: [
        {
          id: "activity-1",
          type: "deck.updated",
          actorUid: "account-1",
          actorName: "Michał Hoffman",
          occurredAt: "2026-08-22T08:15:00.000Z",
          resourceId: "deck-1",
          resourceName: "Visitor welcome",
          resourceType: "deck",
          changedFields: ["name", "defaultDisplayDurationSeconds"],
        },
      ],
      nextCursor: "older-page",
    }),
    true,
  );
});

test("accepts slide activity in the shared workspace audit feed", () => {
  assert.equal(
    isActivityListResponse({
      activity: [
        {
          id: "activity-2",
          type: "slide.created",
          actorUid: "account-1",
          actorName: "Michał Hoffman",
          occurredAt: "2026-08-22T08:16:00.000Z",
          resourceId: "slide-1",
          resourceName: "Visitor welcome",
          resourceType: "slide",
        },
      ],
      nextCursor: null,
    }),
    true,
  );
});

test("rejects unsupported or malformed activity entries", () => {
  assert.equal(
    isActivityListResponse({
      activity: [
        {
          id: "activity-1",
          type: "deck.deleted",
          actorUid: "account-1",
          actorName: "Michał Hoffman",
          occurredAt: "not-a-date",
          resourceId: "deck-1",
          resourceName: "Visitor welcome",
          resourceType: "deck",
        },
      ],
      nextCursor: null,
    }),
    false,
  );
});
