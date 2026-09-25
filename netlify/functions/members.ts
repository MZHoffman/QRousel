import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { WORKSPACE_ROLES, type WorkspaceRole } from "../../lib/workspaces/api-response.ts";
import { authenticateActiveAccount } from "./_shared/authenticated-account.ts";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

const headers = { "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const token = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer\s+/, "").trim() || null;
const role = (value: unknown): value is WorkspaceRole => typeof value === "string" && WORKSPACE_ROLES.includes(value as WorkspaceRole);
const rank: Record<WorkspaceRole, number> = { founder: 4, owner: 3, admin: 2, editor: 1, viewer: 0 };
const canManage = (actor: WorkspaceRole, target: WorkspaceRole) => rank[actor] > rank[target];

export default async function members(request: Request) {
  try {
    const idToken = token(request); if (!idToken) return json({ error: "Authentication required." }, 401);
    const account = await authenticateActiveAccount(idToken); if (!account) return json({ error: "Authentication required." }, 401);
    const url = new URL(request.url), workspaceId = url.searchParams.get("workspaceId")?.trim(), memberUid = url.searchParams.get("memberUid")?.trim() || null;
    if (!workspaceId) return json({ error: "A workspace is required." }, 400);
    const db = getFirestore(getFirebaseAdminApp()), workspace = db.doc(`workspaces/${workspaceId}`), actorMembership = db.doc(`workspaceMemberships/${workspaceId}_${account.uid}`);
    const [workspaceSnapshot, actorSnapshot] = await db.getAll(workspace, actorMembership); const actorRole = actorSnapshot.get("role");
    if (!workspaceSnapshot.exists || workspaceSnapshot.get("status") !== "active" || !actorSnapshot.exists || actorSnapshot.get("status") !== "active" || !role(actorRole)) return json({ error: "Workspace access denied." }, 403);
    if (request.method === "GET") {
      const memberships = await db.collection("workspaceMemberships").where("workspaceId", "==", workspaceId).where("status", "==", "active").get();
      const accounts = await db.getAll(...memberships.docs.map((member) => db.doc(`accounts/${member.get("accountUid")}`)));
      return json({ members: memberships.docs.flatMap((member, index) => { const memberRole = member.get("role"), accountSnapshot = accounts[index], uid = member.get("accountUid"); return role(memberRole) && typeof uid === "string" ? [{ uid, role: memberRole, displayName: typeof accountSnapshot?.get("displayName") === "string" ? accountSnapshot.get("displayName") : null, email: typeof accountSnapshot?.get("email") === "string" ? accountSnapshot.get("email") : null }] : []; }).sort((a, b) => rank[b.role] - rank[a.role] || a.email?.localeCompare(b.email ?? "") || 0) });
    }
    if (!memberUid || (request.method !== "PATCH" && request.method !== "DELETE")) return json({ error: "Method not allowed." }, 405);
    const targetMembership = db.doc(`workspaceMemberships/${workspaceId}_${memberUid}`);
    const result = await db.runTransaction(async (transaction) => {
      const target = await transaction.get(targetMembership); const targetRole = target.get("role"); const body: unknown = request.method === "PATCH" ? await request.json().catch(() => null) : null;
      const transfer = body && typeof body === "object" && "transferFounder" in body && body.transferFounder === true;
      if (transfer) { if (actorRole !== "founder" || !target.exists || target.get("status") !== "active" || !role(targetRole) || targetRole === "founder") return { kind: "denied" as const }; const now = FieldValue.serverTimestamp(); transaction.update(actorMembership, { role: "owner", updatedAt: now }); transaction.update(targetMembership, { role: "founder", updatedAt: now, updatedBy: account.uid }); transaction.update(workspace, { founderUid: memberUid, updatedAt: now }); transaction.set(workspace.collection("activity").doc(), { type: "workspace.founder-transferred", actorUid: account.uid, createdAt: now, resourceId: memberUid, resourceName: "New founder", resourceType: "workspace", workspaceId }); return { kind: "transferred" as const }; }
      if (!target.exists || target.get("status") !== "active" || !role(targetRole) || !canManage(actorRole, targetRole)) return { kind: "denied" as const };
      const now = FieldValue.serverTimestamp(); const activity = workspace.collection("activity").doc();
      if (request.method === "DELETE") { transaction.update(targetMembership, { status: "revoked", revokedAt: now, revokedBy: account.uid, updatedAt: now }); transaction.set(activity, { type: "member.removed", actorUid: account.uid, createdAt: now, resourceId: memberUid, resourceName: "Workspace member", resourceType: "workspace", workspaceId }); return { kind: "removed" as const }; }
      const nextRole = body && typeof body === "object" && "role" in body ? body.role : null;
      if (!role(nextRole) || nextRole === "founder" || rank[nextRole] >= rank[actorRole]) return { kind: "invalid" as const };
      transaction.update(targetMembership, { role: nextRole, updatedAt: now, updatedBy: account.uid }); transaction.set(activity, { type: "member.role-updated", actorUid: account.uid, createdAt: now, resourceId: memberUid, resourceName: "Workspace member", resourceType: "workspace", changedFields: ["role"], workspaceId }); return { kind: "updated" as const, role: nextRole };
    });
    if (result.kind === "denied") return json({ error: "You cannot manage this member." }, 403);
    if (result.kind === "invalid") return json({ error: "Choose a role below your own access level." }, 400);
    return json(result);
  } catch (error) { console.error("Member request failed.", error); return json({ error: "Member access is unavailable." }, 503); }
}
