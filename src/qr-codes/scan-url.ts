import type { QrCodeSummary } from "../../lib/qr-codes/api-response";
export function qrPayload(code: Pick<QrCodeSummary, "id" | "kind" | "content">): string { return code.kind === "url" || code.kind === "email" || code.kind === "phone" ? new URL(`/r/${encodeURIComponent(code.id)}`, window.location.origin).toString() : code.content; }
