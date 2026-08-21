import assert from "node:assert/strict";
import test from "node:test";
import { requestDeckDuplication } from "../src/decks/deck-client.ts";

test("requests an authenticated independent deck copy", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    assert.equal(
      input,
      "/api/workspaces/workspace-1/decks/deck-1/duplicate",
    );
    assert.equal(init?.method, "POST");
    assert.deepEqual(init?.headers, {
      authorization: "Bearer test-token",
      "content-type": "application/json",
    });
    assert.equal(
      init?.body,
      JSON.stringify({
        name: "Visitor welcome",
        defaultDisplayDurationSeconds: 24,
      }),
    );
    return Response.json(
      {
        deck: {
          id: "deck-copy",
          name: "Visitor welcome",
          publicationStatus: "draft",
          defaultDisplayDurationSeconds: 24,
          slideCount: 0,
          version: 1,
        },
      },
      { status: 201 },
    );
  };

  try {
    const result = await requestDeckDuplication(
      { getIdToken: async () => "test-token" },
      "workspace-1",
      "deck-1",
      {
        name: "Visitor welcome",
        defaultDisplayDurationSeconds: 24,
      },
    );
    assert.deepEqual(result, {
      kind: "duplicated",
      deck: {
        id: "deck-copy",
        name: "Visitor welcome",
        publicationStatus: "draft",
        defaultDisplayDurationSeconds: 24,
        slideCount: 0,
        version: 1,
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
