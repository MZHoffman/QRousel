import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { QrCodeKind } from "../../lib/qr-codes/creation";
import { createQrCode, requestQrCodes } from "./qr-code-client";

export function useQrCodeLibrary(user: User, workspaceId: string) {
  const [codes, setCodes] = useState<Awaited<ReturnType<typeof requestQrCodes>>>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  useEffect(() => { let active = true; void requestQrCodes(user, workspaceId).then((items) => { if (active) { setCodes(items); setStatus("ready"); } }, () => { if (active) { setStatus("error"); setError("QRousel could not load your QR codes."); } }); return () => { active = false; }; }, [user, workspaceId]);
  async function create(input: { name: string; kind: QrCodeKind; value: string; color: string; version: number }) {
    try { const result = await createQrCode(user, workspaceId, input); if (result.kind === "limit") { setError(`This workspace can contain up to ${result.limit} QR codes.`); return false; } setCodes((current) => [result.qrCode, ...current]); return true; } catch (reason) { setError(reason instanceof Error ? reason.message : "QRousel could not create this QR code."); return false; }
  }
  return { codes, status, error, create };
}
