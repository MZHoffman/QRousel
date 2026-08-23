import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isIconLimitResponse, isIconListResponse, isIconResponse, type IconSummary } from "../../lib/icons/api-response";

const endpoint = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}/icons`;
export function useIconLibrary(user: User, workspaceId: string) {
  const [icons, setIcons] = useState<IconSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  async function headers() { return { authorization: `Bearer ${await user.getIdToken()}` }; }
  useEffect(() => { let active = true; void headers().then(value => fetch(endpoint(workspaceId), { headers: value })).then(async response => { const body: unknown = await response.json().catch(() => null); if (!response.ok || !isIconListResponse(body)) throw new Error(); return body.icons; }).then(items => { if (active) { setIcons(items); setState("ready"); } }, () => { if (active) { setState("error"); setError("QRousel could not load your icons."); } }); return () => { active = false; }; }, [user, workspaceId]);
  async function create(name: string, imageDataUrl: string) {
    setError("");
    try { const response = await fetch(endpoint(workspaceId), { method: "POST", headers: { ...(await headers()), "content-type": "application/json" }, body: JSON.stringify({ name, imageDataUrl }) }); const body: unknown = await response.json().catch(() => null); if (response.ok && isIconResponse(body)) { setIcons(current => [body.icon, ...current]); return true; } if (response.status === 409 && isIconLimitResponse(body)) setError(`This workspace can contain up to ${body.limit} icons.`); else setError("QRousel could not create this icon."); return false; } catch { setError("QRousel could not create this icon."); return false; }
  }
  return { icons, state, error, create };
}
