import type { User } from "firebase/auth";
import {
  isWorkspaceCreationResponse,
  isWorkspaceLimitResponse,
  isWorkspaceListResponse,
  type WorkspaceSummary,
} from "../../lib/workspaces/api-response";

export type WorkspaceCreationOutcome =
  | { kind: "created"; workspace: WorkspaceSummary }
  | { kind: "limit"; limit: number };

async function authorizationHeaders(user: User): Promise<HeadersInit> {
  return {
    authorization: `Bearer ${await user.getIdToken()}`,
  };
}

export async function requestWorkspaces(
  user: User,
): Promise<WorkspaceSummary[]> {
  const response = await fetch("/api/workspaces", {
    headers: await authorizationHeaders(user),
  });
  const body: unknown = await response.json().catch(() => null);

  if (response.ok && isWorkspaceListResponse(body)) {
    return body.workspaces;
  }

  throw new Error("QRousel could not load your workspaces.");
}

export async function requestWorkspaceCreation(
  user: User,
  name: string,
): Promise<WorkspaceCreationOutcome> {
  const response = await fetch("/api/workspaces", {
    method: "POST",
    headers: {
      ...(await authorizationHeaders(user)),
      "content-type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  const body: unknown = await response.json().catch(() => null);

  if (response.ok && isWorkspaceCreationResponse(body)) {
    return { kind: "created", workspace: body.workspace };
  }
  if (response.status === 409 && isWorkspaceLimitResponse(body)) {
    return { kind: "limit", limit: body.limit };
  }

  throw new Error("QRousel could not create this workspace.");
}
