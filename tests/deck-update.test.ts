import assert from "node:assert/strict";
import test from "node:test";
import { decideDeckUpdate } from "../lib/decks/update.ts";

test("prepares an explicit deck settings update with a new version", () => {
  assert.deepEqual(
    decideDeckUpdate({
      currentVersion: 3,
      expectedVersion: 3,
      requestedName: "  Visitor welcome  ",
      requestedDefaultDisplayDurationSeconds: 24,
    }),
    {
      kind: "update",
      name: "Visitor welcome",
      defaultDisplayDurationSeconds: 24,
      nextVersion: 4,
    },
  );
});

test("detects a stale editor before changing deck settings", () => {
  assert.deepEqual(
    decideDeckUpdate({
      currentVersion: 4,
      expectedVersion: 3,
      requestedName: "Stale name",
      requestedDefaultDisplayDurationSeconds: 18,
    }),
    { kind: "conflict", currentVersion: 4 },
  );
});

test("rejects invalid deck settings and versions", () => {
  assert.throws(
    () =>
      decideDeckUpdate({
        currentVersion: 1,
        expectedVersion: 1,
        requestedName: "   ",
        requestedDefaultDisplayDurationSeconds: 15,
      }),
    /name is required/,
  );
  assert.throws(
    () =>
      decideDeckUpdate({
        currentVersion: 1,
        expectedVersion: 1,
        requestedName: "Welcome",
        requestedDefaultDisplayDurationSeconds: 0,
      }),
    /duration is invalid/,
  );
  assert.throws(
    () =>
      decideDeckUpdate({
        currentVersion: 0,
        expectedVersion: 0,
        requestedName: "Welcome",
        requestedDefaultDisplayDurationSeconds: 15,
      }),
    /version is invalid/,
  );
});
