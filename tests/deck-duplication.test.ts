import assert from "node:assert/strict";
import test from "node:test";
import { decideDeckDuplication } from "../lib/decks/duplication.ts";
import { DECK_LIMIT } from "../lib/decks/creation.ts";

test("prepares an independent draft copy with selected settings", () => {
  assert.deepEqual(
    decideDeckDuplication({
      deckCount: 7,
      sourceName: "Autumn campaign",
      sourceDefaultDisplayDurationSeconds: 15,
      requestedName: "Visitor welcome",
      requestedDefaultDisplayDurationSeconds: 24,
    }),
    {
      kind: "duplicate",
      name: "Visitor welcome",
      defaultDisplayDurationSeconds: 24,
      nextDeckCount: 8,
      publicationStatus: "draft",
      slideCount: 0,
      version: 1,
    },
  );
});

test("stops duplication when the workspace deck limit is reached", () => {
  assert.deepEqual(
    decideDeckDuplication({
      deckCount: DECK_LIMIT,
      sourceName: "Autumn campaign",
      sourceDefaultDisplayDurationSeconds: 15,
    }),
    { kind: "limit", limit: 100 },
  );
});

test("rejects invalid copy settings and resource counters", () => {
  assert.throws(
    () =>
      decideDeckDuplication({
        deckCount: -1,
        sourceName: "Autumn campaign",
        sourceDefaultDisplayDurationSeconds: 15,
      }),
    /counter is invalid/,
  );
  assert.throws(
    () =>
      decideDeckDuplication({
        deckCount: 0,
        sourceName: "Autumn campaign",
        sourceDefaultDisplayDurationSeconds: 15,
        requestedName: "  ",
      }),
    /name is required/,
  );
  assert.throws(
    () =>
      decideDeckDuplication({
        deckCount: 0,
        sourceName: "Autumn campaign",
        sourceDefaultDisplayDurationSeconds: 15,
        requestedDefaultDisplayDurationSeconds: 0,
      }),
    /duration is invalid/,
  );
});
