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
    case "qr-code.created":
      return {
        title: "QR code created",
        detail: `${entry.actorName} created ${namedResource(entry)}.`,
      };
    case "icon.created":
      return { title: "Icon created", detail: `${entry.actorName} created ${namedResource(entry)}.` };
    case "resource.archived":
      return { title: "Resource archived", detail: `${entry.actorName} moved ${namedResource(entry)} to Trash.` };
    case "resource.restored":
      return { title: "Resource restored", detail: `${entry.actorName} restored ${namedResource(entry)} from Trash.` };
    case "resource.deleted":
      return { title: "Resource permanently deleted", detail: `${entry.actorName} permanently deleted ${namedResource(entry)}.` };
    case "member.role-updated":
      return { title: "Member role changed", detail: `${entry.actorName} changed access for ${namedResource(entry)}.` };
    case "member.removed":
      return { title: "Member removed", detail: `${entry.actorName} removed ${namedResource(entry)} from this workspace.` };
    case "invitation.created":
      return { title: "Invitation created", detail: `${entry.actorName} created an invitation for ${namedResource(entry)}.` };
    case "invitation.accepted":
      return { title: "Invitation accepted", detail: `${entry.actorName} joined this workspace.` };
    case "workspace.founder-transferred":
      return { title: "Workspace founder transferred", detail: `${entry.actorName} transferred founder responsibility to ${namedResource(entry)}.` };
  }
}
