export const WORKSPACE_ROLES = [
  "founder",
  "owner",
  "admin",
  "editor",
  "viewer",
] as const;

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export type WorkspaceSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

export type WorkspaceListResponse = {
  workspaces: WorkspaceSummary[];
};

export type WorkspaceCreationResponse = {
  workspace: WorkspaceSummary;
};

export type WorkspaceLimitResponse = {
  status: "limit_reached";
  limit: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWorkspaceSummary(value: unknown): value is WorkspaceSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.role === "string" &&
    WORKSPACE_ROLES.includes(value.role as WorkspaceRole)
  );
}

export function isWorkspaceListResponse(
  value: unknown,
): value is WorkspaceListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.workspaces) &&
    value.workspaces.every(isWorkspaceSummary)
  );
}

export function isWorkspaceCreationResponse(
  value: unknown,
): value is WorkspaceCreationResponse {
  return isRecord(value) && isWorkspaceSummary(value.workspace);
}

export function isWorkspaceLimitResponse(
  value: unknown,
): value is WorkspaceLimitResponse {
  return (
    isRecord(value) &&
    value.status === "limit_reached" &&
    Number.isSafeInteger(value.limit) &&
    Number(value.limit) > 0
  );
}
