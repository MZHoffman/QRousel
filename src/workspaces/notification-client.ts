import type { User } from "firebase/auth";

export type WorkspaceNotification = {
  id: string;
  type: "founder-transferred";
  message: string;
  successorUid: string;
};

function endpoint(workspaceId: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/notifications`;
}

async function headers(user: User): Promise<Record<string, string>> {
  return { authorization: `Bearer ${await user.getIdToken()}` };
}

export async function requestWorkspaceNotifications(user: User, workspaceId: string): Promise<WorkspaceNotification[]> {
  const response = await fetch(endpoint(workspaceId), { headers: await headers(user) });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object" || !("notifications" in body) || !Array.isArray(body.notifications)) {
    throw new Error("QRousel could not load workspace notifications.");
  }
  return body.notifications.filter((item): item is WorkspaceNotification =>
    typeof item === "object" && item !== null &&
    "id" in item && typeof item.id === "string" &&
    "type" in item && item.type === "founder-transferred" &&
    "message" in item && typeof item.message === "string" &&
    "successorUid" in item && typeof item.successorUid === "string",
  );
}

export async function markWorkspaceNotificationRead(user: User, workspaceId: string, notificationId: string): Promise<void> {
  const response = await fetch(endpoint(workspaceId), {
    method: "PATCH",
    headers: { ...(await headers(user)), "content-type": "application/json" },
    body: JSON.stringify({ notificationId }),
  });
  if (!response.ok) throw new Error("QRousel could not dismiss this notification.");
}
