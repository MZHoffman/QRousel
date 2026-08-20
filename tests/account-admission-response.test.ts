import assert from "node:assert/strict";
import test from "node:test";
import { isAccountAdmissionResponse } from "../lib/accounts/admission-response.ts";

test("accepts supported admission responses", () => {
  assert.equal(
    isAccountAdmissionResponse({ status: "active", newAccount: true }),
    true,
  );
  assert.equal(
    isAccountAdmissionResponse({
      status: "capacity_reached",
      limit: 200,
    }),
    true,
  );
});

test("rejects malformed admission responses", () => {
  assert.equal(isAccountAdmissionResponse({ status: "active" }), false);
  assert.equal(
    isAccountAdmissionResponse({ status: "capacity_reached", limit: 500 }),
    false,
  );
  assert.equal(isAccountAdmissionResponse(null), false);
});
