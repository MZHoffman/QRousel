export const WORKSPACE_NAVIGATION = [
  { id: "overview", label: "Overview" },
  { id: "decks", label: "Decks" },
  { id: "slides", label: "Slides" },
  { id: "qr-codes", label: "QR codes" },
  { id: "icons", label: "Icons" },
  { id: "members", label: "Members" },
  { id: "activity", label: "Activity" },
  { id: "trash", label: "Trash" },
] as const;

export type WorkspaceSection = (typeof WORKSPACE_NAVIGATION)[number]["id"];

const WORKSPACE_SECTION_IDS = new Set<WorkspaceSection>(
  WORKSPACE_NAVIGATION.map(({ id }) => id),
);

export function workspaceSectionPath(
  workspaceId: string,
  section: WorkspaceSection,
): string {
  const workspacePath = `/app/workspaces/${encodeURIComponent(workspaceId)}`;
  return section === "overview" ? workspacePath : `${workspacePath}/${section}`;
}

export function resolveWorkspaceSection(pathname: string): WorkspaceSection {
  const candidate = pathname.split("/").filter(Boolean)[3];
  return candidate && WORKSPACE_SECTION_IDS.has(candidate as WorkspaceSection)
    ? (candidate as WorkspaceSection)
    : "overview";
}

export function workspaceLandingPath(
  workspaceId: string,
  currentPathname: string,
): string {
  const section = resolveWorkspaceSection(currentPathname);
  const expectedPath = workspaceSectionPath(workspaceId, section);
  const deckPrefix = `${workspaceSectionPath(workspaceId, "decks")}/`;
  const encodedDeckId = currentPathname.startsWith(deckPrefix)
    ? currentPathname.slice(deckPrefix.length)
    : "";
  if (encodedDeckId.length > 0 && !encodedDeckId.includes("/")) {
    try {
      if (decodeURIComponent(encodedDeckId).trim().length > 0) {
        return currentPathname;
      }
    } catch {
      // Fall through to the workspace overview for malformed paths.
    }
  }
  return currentPathname === expectedPath
    ? currentPathname
    : workspaceSectionPath(workspaceId, "overview");
}
