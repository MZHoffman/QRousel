import assert from "node:assert/strict";
import test from "node:test";
import {
  QR_CODE_LIMIT,
  decideQrCodeCreation,
} from "../lib/qr-codes/creation.ts";

test("prepares a reusable phone QR code with a normalized tel target", () => {
  assert.deepEqual(
    decideQrCodeCreation({
      qrCodeCount: 12,
      requestedName: "  Call reception  ",
      kind: "phone",
      value: " +442012345678 ",
      color: "#173D2C",
      version: 8,
    }),
    {
      kind: "create",
      name: "Call reception",
      content: "tel:+442012345678",
      color: "#173D2C",
      version: 8,
      nextQrCodeCount: 13,
    },
  );
});

test("stops QR code creation at the workspace limit", () => {
  assert.deepEqual(
    decideQrCodeCreation({
      qrCodeCount: QR_CODE_LIMIT,
      requestedName: "One too many",
      kind: "text",
      value: "No more",
      color: "#000000",
      version: 0,
    }),
    { kind: "limit", limit: 500 },
  );
});
