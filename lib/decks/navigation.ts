import { workspaceSectionPath } from "../workspaces/navigation.ts";

export function workspaceDeckPath(
  workspaceId: string,
  deckId: string,
): string {
  return `${workspaceSectionPath(workspaceId, "decks")}/${encodeURIComponent(deckId)}`;
}

export function resolveWorkspaceDeckId(
  pathname: string,
  workspaceId: string,
): string | null {
  const prefix = `${workspaceSectionPath(workspaceId, "decks")}/`;
  if (!pathname.startsWith(prefix)) return null;
  const encodedDeckId = pathname.slice(prefix.length);
  if (encodedDeckId.length === 0 || encodedDeckId.includes("/")) return null;
  try {
    const deckId = decodeURIComponent(encodedDeckId).trim();
    return deckId.length > 0 ? deckId : null;
  } catch {
    return null;
  }
}
