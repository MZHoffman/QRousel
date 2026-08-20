import assert from "node:assert/strict";
import test from "node:test";
import { readFirebasePublicConfig } from "../lib/firebase/config.ts";

const completeEnvironment = {
  VITE_FIREBASE_API_KEY: "api-key",
  VITE_FIREBASE_AUTH_DOMAIN: "qrousel.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "qrousel",
  VITE_FIREBASE_APP_ID: "1:123:web:abc",
};

test("treats an entirely absent Firebase environment as unconfigured", () => {
  assert.equal(readFirebasePublicConfig({}), null);
});

test("returns a trimmed Firebase configuration when every value is present", () => {
  assert.deepEqual(
    readFirebasePublicConfig({
      ...completeEnvironment,
      VITE_FIREBASE_PROJECT_ID: "  qrousel  ",
    }),
    {
      apiKey: "api-key",
      authDomain: "qrousel.firebaseapp.com",
      projectId: "qrousel",
      appId: "1:123:web:abc",
    },
  );
});

test("rejects a partially configured Firebase environment", () => {
  assert.throws(
    () =>
      readFirebasePublicConfig({
        VITE_FIREBASE_PROJECT_ID: "qrousel",
      }),
    /Missing: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_APP_ID/,
  );
});
