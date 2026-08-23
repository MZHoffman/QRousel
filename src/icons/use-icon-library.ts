import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { isIconLimitResponse, isIconListResponse, isIconResponse, type IconSummary } from "../../lib/icons/api-response";

const endpoint = (workspaceId: string) => `/api/workspaces/${encodeURIComponent(workspaceId)}/icons`;
async function authorizationHeaders(user: Pick<User, "getIdToken">) { return { authorization: `Bearer ${await user.getIdToken()}` }; }

export function useIconLibrary(user: User, workspaceId: string) {
  const [icons, setIcons] = useState<IconSummary[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch(endpoint(workspaceId), { headers: await authorizationHeaders(user) });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !isIconListResponse(body)) throw new Error();
        if (active) { setIcons(body.icons); setState("ready"); }
      } catch {
        if (active) { setState("error"); setError("QRousel could not load your icons."); }
      }
    })();
    return () => { active = false; };
  }, [user, workspaceId]);
  async function create(name: string, imageDataUrl: string) {
    setError("");
    try {
      const response = await fetch(endpoint(workspaceId), { method: "POST", headers: { ...(await authorizationHeaders(user)), "content-type": "application/json" }, body: JSON.stringify({ name, imageDataUrl }) });
      const body: unknown = await response.json().catch(() => null);
      if (response.ok && isIconResponse(body)) { setIcons((current) => [body.icon, ...current]); return true; }
      setError(response.status === 409 && isIconLimitResponse(body) ? `This workspace can contain up to ${body.limit} icons.` : "QRousel could not create this icon.");
      return false;
    } catch { setError("QRousel could not create this icon."); return false; }
  }
  return { icons, state, error, create };
}
