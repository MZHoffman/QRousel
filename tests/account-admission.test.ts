import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_ACCOUNT_LIMIT,
  decideAccountAdmission,
} from "../lib/accounts/admission.ts";

test("admits a new account below capacity", () => {
  assert.deepEqual(decideAccountAdmission({ activeCount: 42 }), {
    kind: "admit",
    nextActiveCount: 43,
    notificationThreshold: null,
  });
});

test("lets an existing active account sign in at capacity", () => {
  assert.deepEqual(
    decideAccountAdmission({
      activeCount: ACTIVE_ACCOUNT_LIMIT,
      existingStatus: "active",
    }),
    { kind: "existing", status: "active" },
  );
});

test("preserves a suspended account without consuming another place", () => {
  assert.deepEqual(
    decideAccountAdmission({ activeCount: 50, existingStatus: "suspended" }),
    { kind: "existing", status: "suspended" },
  );
});

test("treats a deleted profile as a new admission", () => {
  assert.deepEqual(
    decideAccountAdmission({ activeCount: 198, existingStatus: "deleted" }),
    {
      kind: "admit",
      nextActiveCount: 199,
      notificationThreshold: null,
    },
  );
});

test("rejects a new account at capacity", () => {
  assert.deepEqual(
    decideAccountAdmission({ activeCount: ACTIVE_ACCOUNT_LIMIT }),
    { kind: "capacity", limit: ACTIVE_ACCOUNT_LIMIT },
  );
});

test("marks operator notification thresholds", () => {
  assert.deepEqual(decideAccountAdmission({ activeCount: 194 }), {
    kind: "admit",
    nextActiveCount: 195,
    notificationThreshold: 195,
  });
});

test("fails closed when the authoritative counter is invalid", () => {
  assert.throws(
    () => decideAccountAdmission({ activeCount: -1 }),
    /counter is invalid/,
  );
});
