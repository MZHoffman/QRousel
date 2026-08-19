import assert from "node:assert/strict";
import test from "node:test";
import { readFirebasePublicConfig } from "../lib/firebase/config.ts";

const completeEnvironment = {
  NEXT_PUBLIC_FIREBASE_API_KEY: "api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "qrousel.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "qrousel",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
};

test("treats an entirely absent Firebase environment as unconfigured", () => {
  assert.equal(readFirebasePublicConfig({}), null);
});

test("returns a trimmed Firebase configuration when every value is present", () => {
  assert.deepEqual(
    readFirebasePublicConfig({
      ...completeEnvironment,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "  qrousel  ",
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
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "qrousel",
      }),
    /Missing: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_APP_ID/,
  );
});
