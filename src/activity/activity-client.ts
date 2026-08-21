import type { User } from "firebase/auth";
import {
  isActivityListResponse,
  type ActivityListResponse,
} from "../../lib/activity/api-response.ts";

type AuthenticatedUser = Pick<User, "getIdToken">;

export async function requestWorkspaceActivity(
  user: AuthenticatedUser,
  workspaceId: string,
  cursor: string | null = null,
): Promise<ActivityListResponse> {
  const query = cursor === null ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  const response = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/activity${query}`,
    {
      headers: {
        authorization: `Bearer ${await user.getIdToken()}`,
      },
    },
  );
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isActivityListResponse(body)) return body;
  throw new Error("QRousel could not load workspace activity.");
}
