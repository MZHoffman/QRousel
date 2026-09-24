import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { authenticateActiveAccount } from "./_shared/authenticated-account.ts";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const SUCCESSOR_PRIORITY = { owner: 4, admin: 3, editor: 2, viewer: 1 } as const;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function successorPriority(value: unknown): number {
  return typeof value === "string" && value in SUCCESSOR_PRIORITY
    ? SUCCESSOR_PRIORITY[value as keyof typeof SUCCESSOR_PRIORITY]
    : 0;
}

async function deleteWorkspaceMemberships(accountUid: string): Promise<void> {
  const firestore = getFirestore(getFirebaseAdminApp());
  const memberships = await firestore
    .collection("workspaceMemberships")
    .where("accountUid", "==", accountUid)
    .where("status", "==", "active")
    .get();

  for (const membership of memberships.docs) {
    const workspaceId = membership.get("workspaceId");
    if (typeof workspaceId !== "string" || workspaceId.length === 0) continue;

    const workspaceRef = firestore.doc(`workspaces/${workspaceId}`);
    await firestore.runTransaction(async (transaction) => {
      const workspace = await transaction.get(workspaceRef);
      const isFounder = workspace.exists && workspace.get("founderUid") === accountUid;
      const candidates = isFounder
        ? await transaction.get(
            firestore.collection("workspaceMemberships")
              .where("workspaceId", "==", workspaceId)
              .where("status", "==", "active"),
          )
        : null;
      const now = FieldValue.serverTimestamp();

      // Firestore transactions require every read before their first write.
      transaction.update(membership.ref, { status: "deleted", updatedAt: now });
      if (!isFounder || !workspace.exists || candidates === null) return;

      const successor = candidates.docs
        .filter((candidate) =>
          candidate.id !== membership.id &&
          typeof candidate.get("accountUid") === "string" &&
          successorPriority(candidate.get("role")) > 0,
        )
        .sort((left, right) => {
          const priorityDifference = successorPriority(right.get("role")) - successorPriority(left.get("role"));
          return priorityDifference !== 0 ? priorityDifference : left.id.localeCompare(right.id);
        })[0];

      if (successor) {
        const successorUid = successor.get("accountUid") as string;
        transaction.update(successor.ref, { role: "founder", updatedAt: now, updatedBy: accountUid });
        transaction.update(workspaceRef, { founderUid: successorUid, updatedAt: now });
        transaction.set(workspaceRef.collection("activity").doc(), {
          type: "workspace.founder-transferred", actorUid: accountUid, createdAt: now,
          resourceId: successorUid, resourceName: "New founder", resourceType: "workspace", workspaceId,
        });
        transaction.set(workspaceRef.collection("notifications").doc(), {
          type: "founder-transferred", successorUid,
          message: "The previous founder deleted their account. A new founder has been assigned.",
          createdAt: now, status: "unread",
        });
        return;
      }

      transaction.update(workspaceRef, { status: "archived", archivedAt: now, archivedBy: accountUid, updatedAt: now });
      transaction.set(workspaceRef.collection("activity").doc(), {
        type: "workspace.archived", actorUid: accountUid, createdAt: now,
        resourceId: workspaceId, resourceName: workspace.get("name") ?? "Workspace", resourceType: "workspace", workspaceId,
      });
    });
  }
}

async function markAccountDeleted(accountUid: string): Promise<void> {
  const firestore = getFirestore(getFirebaseAdminApp());
  const accountRef = firestore.doc(`accounts/${accountUid}`);
  const counterRef = firestore.doc("system/accountAdmission");
  await firestore.runTransaction(async (transaction) => {
    const [account, counter] = await Promise.all([transaction.get(accountRef), transaction.get(counterRef)]);
    const activeCount = counter.exists ? counter.get("activeCount") : 0;
    const safeActiveCount = typeof activeCount === "number" && Number.isSafeInteger(activeCount) ? Math.max(0, activeCount) : 0;
    const now = FieldValue.serverTimestamp();
    transaction.set(accountRef, { status: "deleted", deletedAt: now, updatedAt: now }, { merge: true });
    if (account.exists && account.get("status") === "active") {
      transaction.set(counterRef, { activeCount: Math.max(0, safeActiveCount - 1), updatedAt: now }, { merge: true });
    }
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== "DELETE") return jsonResponse({ error: "Method not allowed." }, 405);
  const idToken = readBearerToken(request);
  if (idToken === null) return jsonResponse({ error: "Authentication required." }, 401);

  let body: { confirmation?: unknown };
  try { body = (await request.json()) as { confirmation?: unknown }; }
  catch { return jsonResponse({ error: "Account deletion confirmation is required." }, 400); }
  if (body.confirmation !== "DELETE MY ACCOUNT") {
    return jsonResponse({ error: "Type the confirmation exactly to delete your account." }, 400);
  }

  try {
    const account = await authenticateActiveAccount(idToken);
    if (account === null) return jsonResponse({ error: "Authentication required." }, 401);
    await deleteWorkspaceMemberships(account.uid);
    await markAccountDeleted(account.uid);
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("Account deletion failed.", error);
    return jsonResponse({ error: "QRousel could not delete this account." }, 503);
  }
}
