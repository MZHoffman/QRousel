import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { WORKSPACE_ROLES, type WorkspaceRole } from "../../lib/workspaces/api-response.ts";
import { authenticateActiveAccount } from "./_shared/authenticated-account.ts";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

const headers = { "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const validRole = (value: unknown): value is Exclude<WorkspaceRole, "founder"> => typeof value === "string" && value !== "founder" && WORKSPACE_ROLES.includes(value as WorkspaceRole);
const canInvite = (role: unknown) => role === "founder" || role === "owner" || role === "admin";
const email = (value: unknown): value is string => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const token = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer\s+/, "").trim() || null;
function route(request: Request): { workspaceId: string | null; inviteToken: string | null } {
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId")?.trim() || null;
  const inviteToken = url.searchParams.get("token")?.trim() || null;
  if (workspaceId || inviteToken) return { workspaceId, inviteToken };
  const workspaceMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/invitations$/);
  const inviteMatch = url.pathname.match(/^\/api\/invitations\/([^/]+)\/redeem$/);
  try {
    return {
      workspaceId: workspaceMatch?.[1] ? decodeURIComponent(workspaceMatch[1]).trim() || null : null,
      inviteToken: inviteMatch?.[1] ? decodeURIComponent(inviteMatch[1]).trim() || null : null,
    };
  } catch { return { workspaceId: null, inviteToken: null }; }
}

async function sendEmail(to: string, link: string, workspaceName: string) {
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) return "not-configured" as const;
  const db = getFirestore(getFirebaseAdminApp()), now = new Date(), day = now.toISOString().slice(0, 10), month = now.toISOString().slice(0, 7);
  const daily = db.doc(`system/invitationEmailDaily/${day}`), monthly = db.doc(`system/invitationEmailMonthly/${month}`);
  const reserved = await db.runTransaction(async tx => { const [d, m] = await Promise.all([tx.get(daily), tx.get(monthly)]); const dc = d.exists && Number.isSafeInteger(d.get("count")) ? d.get("count") : 0, mc = m.exists && Number.isSafeInteger(m.get("count")) ? m.get("count") : 0; if (dc >= 10 || mc >= 100) return false; const stamp = FieldValue.serverTimestamp(); tx.set(daily, { count: dc + 1, limit: 10, updatedAt: stamp }, { merge: true }); tx.set(monthly, { count: mc + 1, limit: 100, updatedAt: stamp }, { merge: true }); return true; });
  if (!reserved) return "limit" as const;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ from, to: [to], subject: `You are invited to ${workspaceName} on QRousel`, text: `Join ${workspaceName} on QRousel: ${link}` }) });
  return response.ok ? "sent" as const : "failed" as const;
}

export default async function invitations(request: Request) {
  try {
    const idToken = token(request); if (!idToken) return json({ error: "Authentication required." }, 401);
    const account = await authenticateActiveAccount(idToken); if (!account) return json({ error: "Authentication required." }, 401);
    const url = new URL(request.url), { workspaceId, inviteToken } = route(request), db = getFirestore(getFirebaseAdminApp());
    if (request.method === "GET" && workspaceId && !inviteToken) { const member = await db.doc(`workspaceMemberships/${workspaceId}_${account.uid}`).get(); if (!member.exists || member.get("status") !== "active" || !canInvite(member.get("role"))) return json({ error: "Only workspace administrators can view invitations." }, 403); const docs = await db.collection("workspaceInvitations").where("workspaceId", "==", workspaceId).get(); return json({ invitations: docs.docs.flatMap(doc => { const role = doc.get("role"), status = doc.get("status"), invitedEmail = doc.get("email"); return validRole(role) && (status === "active" || status === "used") ? [{ token: doc.id, role, status, email: typeof invitedEmail === "string" ? invitedEmail : null }] : []; }) }); }
    if (request.method === "POST" && workspaceId && !inviteToken) { const body: unknown = await request.json().catch(() => null); if (!body || typeof body !== "object" || !("role" in body) || !validRole(body.role) || ("email" in body && body.email !== "" && !email(body.email))) return json({ error: "A valid member role and optional email are required." }, 400); const member = await db.doc(`workspaceMemberships/${workspaceId}_${account.uid}`).get(), workspace = db.doc(`workspaces/${workspaceId}`); if (!member.exists || member.get("status") !== "active" || !canInvite(member.get("role"))) return json({ error: "Only workspace administrators can invite members." }, 403); const ws = await workspace.get(); if (!ws.exists || ws.get("status") !== "active") return json({ error: "Workspace access denied." }, 403); const invitedEmail = "email" in body && email(body.email) ? body.email.trim().toLowerCase() : null, invitation = db.collection("workspaceInvitations").doc(crypto.randomUUID().replaceAll("-", "")), now = FieldValue.serverTimestamp(); await db.runTransaction(async tx => { tx.set(invitation, { workspaceId, role: body.role, status: "active", email: invitedEmail, createdAt: now, createdBy: account.uid }); tx.set(workspace.collection("activity").doc(), { type: "invitation.created", actorUid: account.uid, createdAt: now, resourceId: invitation.id, resourceName: `${body.role} invitation`, resourceType: "workspace", workspaceId }); }); const link = `${url.origin}/app?invite=${encodeURIComponent(invitation.id)}`, delivery = invitedEmail ? await sendEmail(invitedEmail, link, ws.get("name")) : "not-requested"; await invitation.set({ emailDelivery: delivery, emailDeliveryUpdatedAt: FieldValue.serverTimestamp() }, { merge: true }); return json({ token: invitation.id, role: body.role, emailDelivery: delivery }, 201); }
    if (request.method === "POST" && inviteToken) { const invitation = db.doc(`workspaceInvitations/${inviteToken}`), result = await db.runTransaction(async tx => { const current = await tx.get(invitation); if (!current.exists || current.get("status") !== "active") return null; const targetWorkspaceId = current.get("workspaceId"), role = current.get("role"); if (typeof targetWorkspaceId !== "string" || !validRole(role)) return null; const workspace = db.doc(`workspaces/${targetWorkspaceId}`), membership = db.doc(`workspaceMemberships/${targetWorkspaceId}_${account.uid}`); const [ws] = await Promise.all([tx.get(workspace), tx.get(membership)]); if (!ws.exists || ws.get("status") !== "active") return null; const now = FieldValue.serverTimestamp(); tx.set(membership, { accountUid: account.uid, workspaceId: targetWorkspaceId, role, status: "active", createdAt: now }, { merge: true }); tx.update(invitation, { status: "used", usedAt: now, usedBy: account.uid }); tx.set(workspace.collection("activity").doc(), { type: "invitation.accepted", actorUid: account.uid, createdAt: now, resourceId: invitation.id, resourceName: `${role} invitation`, resourceType: "workspace", workspaceId: targetWorkspaceId }); return targetWorkspaceId; }); return result ? json({ workspaceId: result }) : json({ error: "This invitation has expired or was already used." }, 410); }
    return json({ error: "Method not allowed." }, 405);
  } catch (error) { console.error("Invitation request failed.", error); return json({ error: "Invitation access is unavailable." }, 503); }
}
