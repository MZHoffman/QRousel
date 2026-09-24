import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { authenticateActiveAccount } from "./_shared/authenticated-account.ts";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";
import { WORKSPACE_ROLES, type WorkspaceRole } from "../../lib/workspaces/api-response.ts";

const headers = { "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const token = (request: Request) => request.headers.get("authorization")?.replace(/^Bearer\s+/, "").trim() || null;
const types = ["decks", "slides", "qr-codes", "icons"] as const;
type ResourceType = typeof types[number];
const counters: Record<ResourceType, { field: string; limit: number; label: string }> = { decks: { field: "deckCount", limit: 100, label: "deck" }, slides: { field: "slideCount", limit: 500, label: "slide" }, "qr-codes": { field: "qrCodeCount", limit: 500, label: "QR code" }, icons: { field: "iconCount", limit: 100, label: "icon" } };
const collection: Record<ResourceType, string> = { decks: "decks", slides: "slides", "qr-codes": "qrCodes", icons: "icons" };
const role = (value: unknown): value is WorkspaceRole => typeof value === "string" && WORKSPACE_ROLES.includes(value as WorkspaceRole);
const resourceType = (value: string | null): value is ResourceType => typeof value === "string" && (types as readonly string[]).includes(value);

export default async function trash(request: Request) {
  try {
    const idToken = token(request); if (!idToken) return json({ error: "Authentication required." }, 401);
    const account = await authenticateActiveAccount(idToken); if (!account) return json({ error: "Authentication required." }, 401);
    const url = new URL(request.url), workspaceId = url.searchParams.get("workspaceId")?.trim(), type = url.searchParams.get("type"), resourceId = url.searchParams.get("resourceId")?.trim() || null;
    if (!workspaceId || !resourceType(type)) return json({ error: "A valid resource is required." }, 400);
    const db = getFirestore(getFirebaseAdminApp()), workspace = db.doc(`workspaces/${workspaceId}`), membership = db.doc(`workspaceMemberships/${workspaceId}_${account.uid}`), resources = workspace.collection(collection[type]);
    const [workspaceSnapshot, membershipSnapshot] = await db.getAll(workspace, membership); const memberRole = membershipSnapshot.get("role");
    if (!workspaceSnapshot.exists || workspaceSnapshot.get("status") !== "active" || !membershipSnapshot.exists || membershipSnapshot.get("status") !== "active" || !role(memberRole)) return json({ error: "Workspace access denied." }, 403);
    if (request.method === "GET" && !resourceId) { const snapshots = await resources.where("status", "==", "archived").get(); return json({ items: snapshots.docs.flatMap((item) => { const name = type === "slides" ? item.get("title") : item.get("name"); return typeof name === "string" ? [{ id: item.id, type, name }] : []; }) }); }
    if (!resourceId || (request.method !== "PATCH" && request.method !== "DELETE")) return json({ error: "Method not allowed." }, 405);
    if (memberRole === "viewer") return json({ error: "Editing access required." }, 403);
    if (request.method === "DELETE" && memberRole !== "founder") return json({ error: "Only the workspace founder can permanently delete resources." }, 403);
    const resource = resources.doc(resourceId), counter = counters[type];
    const result = await db.runTransaction(async (transaction) => { const [currentWorkspace, currentResource] = await Promise.all([transaction.get(workspace), transaction.get(resource)]); if (!currentResource.exists) return { kind: "missing" as const }; const status = currentResource.get("status"), now = FieldValue.serverTimestamp(), name = type === "slides" ? currentResource.get("title") : currentResource.get("name"); if (typeof name !== "string") return { kind: "missing" as const };
      if (request.method === "DELETE") { if (status !== "archived") return { kind: "state" as const }; transaction.delete(resource); transaction.set(workspace.collection("activity").doc(), { type: "resource.deleted", actorUid: account.uid, createdAt: now, resourceId, resourceName: name, resourceType: type === "qr-codes" ? "qr-code" : type.slice(0, -1), workspaceId }); return { kind: "deleted" as const }; }
      const action = url.searchParams.get("action");
      if (action === "restore") { if (status !== "archived") return { kind: "state" as const }; const count = currentWorkspace.get(counter.field) ?? 0; if (!Number.isSafeInteger(count) || count >= counter.limit) return { kind: "limit" as const }; transaction.update(resource, { status: "active", restoredAt: now, restoredBy: account.uid, updatedAt: now }); transaction.update(workspace, { [counter.field]: count + 1, updatedAt: now }); transaction.set(workspace.collection("activity").doc(), { type: "resource.restored", actorUid: account.uid, createdAt: now, resourceId, resourceName: name, resourceType: type === "qr-codes" ? "qr-code" : type.slice(0, -1), workspaceId }); return { kind: "restored" as const }; }
      if (status !== "active") return { kind: "state" as const }; const count = currentWorkspace.get(counter.field) ?? 0; if (!Number.isSafeInteger(count) || count < 1) return { kind: "state" as const }; transaction.update(resource, { status: "archived", archivedAt: now, archivedBy: account.uid, updatedAt: now }); transaction.update(workspace, { [counter.field]: count - 1, updatedAt: now }); transaction.set(workspace.collection("activity").doc(), { type: "resource.archived", actorUid: account.uid, createdAt: now, resourceId, resourceName: name, resourceType: type === "qr-codes" ? "qr-code" : type.slice(0, -1), workspaceId }); return { kind: "archived" as const };
    });
    if (result.kind === "missing") return json({ error: "Resource not found." }, 404); if (result.kind === "limit") return json({ error: `This workspace already has its ${counter.limit} ${counter.label} limit in active resources.` }, 409); if (result.kind === "state") return json({ error: "This resource cannot be changed in its current state." }, 409); return json({ ok: true });
  } catch (error) { console.error("Trash request failed.", error); return json({ error: "Trash access is unavailable." }, 503); }
}
