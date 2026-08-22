export type QrCodeSummary = {
  id: string;
  name: string;
  content: string;
  color: string;
  version: number;
  revision: number;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function qrCode(value: unknown): value is QrCodeSummary {
  return (
    record(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.content === "string" &&
    typeof value.color === "string" &&
    Number.isSafeInteger(value.version) &&
    Number.isSafeInteger(value.revision)
  );
}

export function isQrCodeListResponse(value: unknown): value is { qrCodes: QrCodeSummary[] } {
  return record(value) && Array.isArray(value.qrCodes) && value.qrCodes.every(qrCode);
}

export function isQrCodeResponse(value: unknown): value is { qrCode: QrCodeSummary } {
  return record(value) && qrCode(value.qrCode);
}

export function isQrCodeLimitResponse(value: unknown): value is { status: "limit_reached"; limit: number } {
  return record(value) && value.status === "limit_reached" && Number.isSafeInteger(value.limit);
}
