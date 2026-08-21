export const WORKSPACE_CREATION_LIMIT = 5;

export type WorkspaceCreationDecision =
  | {
      kind: "create";
      name: string;
      nextCreatedWorkspaceCount: number;
    }
  | {
      kind: "limit";
      limit: number;
    };

type WorkspaceCreationInput = {
  createdWorkspaceCount: number;
  requestedName: string;
};

export function decideWorkspaceCreation({
  createdWorkspaceCount,
  requestedName,
}: WorkspaceCreationInput): WorkspaceCreationDecision {
  if (
    !Number.isSafeInteger(createdWorkspaceCount) ||
    createdWorkspaceCount < 0
  ) {
    throw new Error("The created workspace counter is invalid.");
  }

  const name = requestedName.trim();
  if (name.length === 0) {
    throw new Error("A workspace name is required.");
  }

  if (createdWorkspaceCount >= WORKSPACE_CREATION_LIMIT) {
    return { kind: "limit", limit: WORKSPACE_CREATION_LIMIT };
  }

  return {
    kind: "create",
    name,
    nextCreatedWorkspaceCount: createdWorkspaceCount + 1,
  };
}
