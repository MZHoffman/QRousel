export const QR_CODE_LIMIT = 500;

export const QR_CODE_KINDS = ["url", "email", "phone", "wifi", "text"] as const;

export type QrCodeKind = (typeof QR_CODE_KINDS)[number];

type QrCodeCreationInput = {
  qrCodeCount: number;
  requestedName: string;
  kind: QrCodeKind;
  value: string;
  color: string;
  version: number;
};

export type QrCodeCreationDecision =
  | {
      kind: "create";
      name: string;
      content: string;
      color: string;
      version: number;
      nextQrCodeCount: number;
    }
  | { kind: "limit"; limit: number };

function contentFor(kind: QrCodeKind, value: string): string {
  switch (kind) {
    case "email":
      return `mailto:${value}`;
    case "phone":
      return `tel:${value}`;
    case "wifi":
      return value.startsWith("WIFI:") ? value : `WIFI:${value}`;
    case "url":
    case "text":
      return value;
  }
}

export function decideQrCodeCreation(
  input: QrCodeCreationInput,
): QrCodeCreationDecision {
  if (!Number.isSafeInteger(input.qrCodeCount) || input.qrCodeCount < 0) {
    throw new Error("The QR code resource counter is invalid.");
  }
  const name = input.requestedName.trim();
  if (name.length === 0) throw new Error("A QR code name is required.");
  if (input.value.trim().length === 0) throw new Error("QR code content is required.");
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) {
    throw new Error("A six-digit QR code colour is required.");
  }
  if (!Number.isSafeInteger(input.version) || input.version < 0 || input.version > 20) {
    throw new Error("The QR code density is invalid.");
  }
  if (input.qrCodeCount >= QR_CODE_LIMIT) {
    return { kind: "limit", limit: QR_CODE_LIMIT };
  }

  return {
    kind: "create",
    name,
    content: contentFor(input.kind, input.value.trim()),
    color: input.color.toUpperCase(),
    version: input.version,
    nextQrCodeCount: input.qrCodeCount + 1,
  };
}
