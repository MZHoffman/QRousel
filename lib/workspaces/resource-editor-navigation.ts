import { workspaceSectionPath, type WorkspaceSection } from "./navigation.ts";

export type ResourceEditorMode = "new" | "edit";

export function workspaceResourceEditorPath(
  workspaceId: string,
  section: Extract<WorkspaceSection, "slides" | "qr-codes" | "icons">,
  mode: ResourceEditorMode,
  resourceId?: string,
): string {
  const base = workspaceSectionPath(workspaceId, section);
  return mode === "new" ? `${base}/new` : `${base}/${encodeURIComponent(resourceId ?? "")}`;
}

export function resolveWorkspaceResourceEditor(
  pathname: string,
  workspaceId: string,
  section: Extract<WorkspaceSection, "slides" | "qr-codes" | "icons">,
): { mode: ResourceEditorMode; resourceId: string | null } | null {
  const prefix = `${workspaceSectionPath(workspaceId, section)}/`;
  if (!pathname.startsWith(prefix)) return null;
  const value = pathname.slice(prefix.length);
  if (!value || value.includes("/")) return null;
  if (value === "new") return { mode: "new", resourceId: null };
  try {
    const resourceId = decodeURIComponent(value).trim();
    return resourceId ? { mode: "edit", resourceId } : null;
  } catch { return null; }
}
