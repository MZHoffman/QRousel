export type QrCodeSummary = {
  id: string;
  name: string;
  content: string;
  kind: "url" | "email" | "phone" | "wifi" | "text";
  iconId?: string | null;
  iconName?: string | null;
  color: string;
  version: number;
  logoScale?: number;
  revision: number;
  scanCount?: number;
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
    (value.kind === "url" || value.kind === "email" || value.kind === "phone" || value.kind === "wifi" || value.kind === "text") &&
    (!("iconId" in value) || value.iconId === null || typeof value.iconId === "string") &&
    (!("iconName" in value) || value.iconName === null || typeof value.iconName === "string") &&
    typeof value.color === "string" &&
    Number.isSafeInteger(value.version) &&
    (!("logoScale" in value) || (typeof value.logoScale === "number" && value.logoScale >= 0.1 && value.logoScale <= 0.5)) &&
    Number.isSafeInteger(value.revision)
    && (!("scanCount" in value) || (Number.isSafeInteger(value.scanCount) && Number(value.scanCount) >= 0))
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
