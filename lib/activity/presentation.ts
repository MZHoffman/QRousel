import type { WorkspaceActivityEntry } from "./api-response.ts";

export type WorkspaceActivityDescription = {
  title: string;
  detail: string;
};

function namedResource(entry: WorkspaceActivityEntry): string {
  return `“${entry.resourceName ?? "Untitled resource"}”`;
}

export function describeWorkspaceActivity(
  entry: WorkspaceActivityEntry,
): WorkspaceActivityDescription {
  switch (entry.type) {
    case "workspace.created":
      return {
        title: "Workspace created",
        detail: `${entry.actorName} created this workspace.`,
      };
    case "deck.created":
      return {
        title: "Deck created",
        detail: `${entry.actorName} created ${namedResource(entry)}.`,
      };
    case "deck.updated":
      return {
        title: "Deck updated",
        detail: `${entry.actorName} updated ${namedResource(entry)}.`,
      };
    case "deck.duplicated":
      return {
        title: "Deck duplicated",
        detail: `${entry.actorName} created the copy ${namedResource(entry)}.`,
      };
    case "slide.created":
      return {
        title: "Slide created",
        detail: `${entry.actorName} created ${namedResource(entry)}.`,
      };
    case "slide.updated":
      return {
        title: "Slide updated",
        detail: `${entry.actorName} updated ${namedResource(entry)}.`,
      };
  }
}
