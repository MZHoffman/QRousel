import type { User } from "firebase/auth";
import {
  isQrCodeLimitResponse,
  isQrCodeListResponse,
  isQrCodeResponse,
} from "../../lib/qr-codes/api-response";
import type { QrCodeKind } from "../../lib/qr-codes/creation";

type AuthenticatedUser = Pick<User, "getIdToken">;
const endpoint = (workspaceId: string) =>
  `/api/workspaces/${encodeURIComponent(workspaceId)}/qr-codes`;
async function headers(user: AuthenticatedUser) {
  return { authorization: `Bearer ${await user.getIdToken()}` };
}
export async function requestQrCodes(user: AuthenticatedUser, workspaceId: string) {
  const response = await fetch(endpoint(workspaceId), { headers: await headers(user) });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isQrCodeListResponse(body)) return body.qrCodes;
  throw new Error("QRousel could not load your QR codes.");
}
export async function createQrCode(user: AuthenticatedUser, workspaceId: string, input: { name: string; kind: QrCodeKind; value: string; color: string; version: number }) {
  const response = await fetch(endpoint(workspaceId), { method: "POST", headers: { ...(await headers(user)), "content-type": "application/json" }, body: JSON.stringify(input) });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isQrCodeResponse(body)) return { kind: "created" as const, qrCode: body.qrCode };
  if (response.status === 409 && isQrCodeLimitResponse(body)) return { kind: "limit" as const, limit: body.limit };
  throw new Error("QRousel could not create this QR code.");
}
