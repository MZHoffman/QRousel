import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { authenticateActiveAccount } from "./_shared/authenticated-account.ts";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function workspaceIdFromRequest(request: Request): string | null {
  const fromQuery = new URL(request.url).searchParams.get("workspaceId")?.trim();
  if (fromQuery) return fromQuery;
  const match = new URL(request.url).pathname.match(/^\/api\/workspaces\/([^/]+)\/notifications$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function hasWorkspaceAccess(workspaceId: string, accountUid: string): Promise<boolean> {
  const firestore = getFirestore(getFirebaseAdminApp());
  const [workspace, membership] = await firestore.getAll(
    firestore.doc(`workspaces/${workspaceId}`),
    firestore.doc(`workspaceMemberships/${workspaceId}_${accountUid}`),
  );
  return workspace.exists && workspace.get("status") === "active" && membership.exists && membership.get("status") === "active";
}

export default async function notifications(request: Request): Promise<Response> {
  const idToken = readBearerToken(request);
  if (idToken === null) return jsonResponse({ error: "Authentication required." }, 401);
  const workspaceId = workspaceIdFromRequest(request);
  if (workspaceId === null) return jsonResponse({ error: "A workspace is required." }, 400);

  try {
    const account = await authenticateActiveAccount(idToken);
    if (account === null) return jsonResponse({ error: "Authentication required." }, 401);
    if (!(await hasWorkspaceAccess(workspaceId, account.uid))) {
      return jsonResponse({ error: "Workspace access denied." }, 403);
    }
    const firestore = getFirestore(getFirebaseAdminApp());
    const notificationsRef = firestore.collection(`workspaces/${workspaceId}/notifications`);

    if (request.method === "GET") {
      const records = await notificationsRef.where("status", "==", "unread").get();
      return jsonResponse({
        notifications: records.docs.flatMap((record) => {
          const type = record.get("type");
          const message = record.get("message");
          const successorUid = record.get("successorUid");
          return type === "founder-transferred" && typeof message === "string" && typeof successorUid === "string"
            ? [{ id: record.id, type, message, successorUid }]
            : [];
        }),
      });
    }

    if (request.method === "PATCH") {
      const body: unknown = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || !("notificationId" in body) || typeof body.notificationId !== "string") {
        return jsonResponse({ error: "A notification is required." }, 400);
      }
      const notificationRef = notificationsRef.doc(body.notificationId);
      await notificationRef.set({ status: "read", readAt: FieldValue.serverTimestamp(), readBy: account.uid }, { merge: true });
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  } catch (error) {
    console.error("Notification request failed.", error);
    return jsonResponse({ error: "QRousel could not load workspace notifications." }, 503);
  }
}
