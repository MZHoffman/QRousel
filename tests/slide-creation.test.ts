import assert from "node:assert/strict";
import test from "node:test";
import { SLIDE_LIMIT, decideSlideCreation } from "../lib/slides/creation.ts";

test("prepares a reusable slide with trimmed content", () => {
  assert.deepEqual(
    decideSlideCreation({
      slideCount: 12,
      requestedTitle: "  Visitor welcome  ",
      requestedDescription: "  Scan to join the event.  ",
    }),
    {
      kind: "create",
      title: "Visitor welcome",
      description: "Scan to join the event.",
      nextSlideCount: 13,
    },
  );
});

test("stops slide creation when all five hundred library places are used", () => {
  assert.deepEqual(
    decideSlideCreation({
      slideCount: SLIDE_LIMIT,
      requestedTitle: "One too many",
      requestedDescription: "No further workspace library places remain.",
    }),
    { kind: "limit", limit: 500 },
  );
  assert.equal(SLIDE_LIMIT, 500);
});

test("rejects a missing title and an invalid slide counter", () => {
  assert.throws(
    () =>
      decideSlideCreation({
        slideCount: 0,
        requestedTitle: "   ",
        requestedDescription: "Description",
      }),
    /title is required/,
  );
  assert.throws(
    () =>
      decideSlideCreation({
        slideCount: -1,
        requestedTitle: "Welcome",
        requestedDescription: "Description",
      }),
    /counter is invalid/,
  );
});
