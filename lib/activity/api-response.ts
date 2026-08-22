export const WORKSPACE_ACTIVITY_TYPES = [
  "workspace.created",
  "deck.created",
  "deck.updated",
  "deck.duplicated",
  "slide.created",
  "slide.updated",
] as const;

export type WorkspaceActivityType =
  (typeof WORKSPACE_ACTIVITY_TYPES)[number];

export type WorkspaceActivityEntry = {
  id: string;
  type: WorkspaceActivityType;
  actorUid: string;
  actorName: string;
  occurredAt: string;
  resourceId: string;
  resourceName: string | null;
  resourceType: "workspace" | "deck" | "slide";
  changedFields?: string[];
};

export type ActivityListResponse = {
  activity: WorkspaceActivityEntry[];
  nextCursor: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function isActivityEntry(value: unknown): value is WorkspaceActivityEntry {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.type === "string" &&
    WORKSPACE_ACTIVITY_TYPES.includes(value.type as WorkspaceActivityType) &&
    typeof value.actorUid === "string" &&
    value.actorUid.length > 0 &&
    typeof value.actorName === "string" &&
    value.actorName.length > 0 &&
    isIsoTimestamp(value.occurredAt) &&
    typeof value.resourceId === "string" &&
    value.resourceId.length > 0 &&
    (value.resourceName === null || typeof value.resourceName === "string") &&
    (value.resourceType === "workspace" ||
      value.resourceType === "deck" ||
      value.resourceType === "slide") &&
    (value.changedFields === undefined ||
      (Array.isArray(value.changedFields) &&
        value.changedFields.every((field) => typeof field === "string")))
  );
}

export function isActivityListResponse(
  value: unknown,
): value is ActivityListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.activity) &&
    value.activity.every(isActivityEntry) &&
    (value.nextCursor === null ||
      (typeof value.nextCursor === "string" && value.nextCursor.length > 0))
  );
}
