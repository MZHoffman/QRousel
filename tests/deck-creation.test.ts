import assert from "node:assert/strict";
import test from "node:test";
import {
  DECK_LIMIT,
  DEFAULT_DECK_DURATION_SECONDS,
  decideDeckCreation,
} from "../lib/decks/creation.ts";

test("prepares a draft deck with the default fifteen-second timing", () => {
  assert.deepEqual(
    decideDeckCreation({
      deckCount: 4,
      requestedName: "  Autumn campaign  ",
    }),
    {
      kind: "create",
      name: "Autumn campaign",
      nextDeckCount: 5,
      defaultDisplayDurationSeconds: DEFAULT_DECK_DURATION_SECONDS,
    },
  );
  assert.equal(DEFAULT_DECK_DURATION_SECONDS, 15);
});

test("stops deck creation when all one hundred resource places are used", () => {
  assert.deepEqual(
    decideDeckCreation({
      deckCount: DECK_LIMIT,
      requestedName: "One too many",
    }),
    { kind: "limit", limit: 100 },
  );
  assert.equal(DECK_LIMIT, 100);
});

test("rejects an empty deck name and an invalid resource counter", () => {
  assert.throws(
    () => decideDeckCreation({ deckCount: 0, requestedName: "   " }),
    /name is required/,
  );
  assert.throws(
    () => decideDeckCreation({ deckCount: -1, requestedName: "Launch" }),
    /counter is invalid/,
  );
});
