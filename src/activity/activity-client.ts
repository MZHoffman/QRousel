import type { User } from "firebase/auth";
import {
  isActivityListResponse,
  type WorkspaceActivityEntry,
} from "../../lib/activity/api-response.ts";

type AuthenticatedUser = Pick<User, "getIdToken">;

export async function requestWorkspaceActivity(
  user: AuthenticatedUser,
  workspaceId: string,
): Promise<WorkspaceActivityEntry[]> {
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/activity`,
    {
      headers: {
        authorization: `Bearer ${await user.getIdToken()}`,
      },
    },
  );
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isActivityListResponse(body)) return body.activity;
  throw new Error("QRousel could not load workspace activity.");
}
