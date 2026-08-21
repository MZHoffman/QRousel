import assert from "node:assert/strict";
import test from "node:test";
import {
  isDeckCreationResponse,
  isDeckLimitResponse,
  isDeckListResponse,
} from "../lib/decks/api-response.ts";

const draftDeck = {
  id: "deck-1",
  name: "Autumn campaign",
  publicationStatus: "draft",
  defaultDisplayDurationSeconds: 15,
  slideCount: 0,
};

test("accepts deck list, creation, and limit responses", () => {
  assert.equal(isDeckListResponse({ decks: [draftDeck] }), true);
  assert.equal(isDeckCreationResponse({ deck: draftDeck }), true);
  assert.equal(
    isDeckLimitResponse({ status: "limit_reached", limit: 100 }),
    true,
  );
});

test("rejects malformed deck responses", () => {
  assert.equal(
    isDeckListResponse({
      decks: [{ ...draftDeck, defaultDisplayDurationSeconds: "15" }],
    }),
    false,
  );
  assert.equal(
    isDeckCreationResponse({ deck: { ...draftDeck, name: "" } }),
    false,
  );
  assert.equal(
    isDeckLimitResponse({ status: "limit_reached", limit: -1 }),
    false,
  );
});
