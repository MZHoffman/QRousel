import { FieldValue, getFirestore, type DocumentSnapshot } from "firebase-admin/firestore";
import type { QrCodeSummary } from "../../lib/qr-codes/api-response.ts";
import { decideQrCodeCreation, QR_CODE_KINDS, type QrCodeKind } from "../../lib/qr-codes/creation.ts";
import { WORKSPACE_ROLES, type WorkspaceRole } from "../../lib/workspaces/api-response.ts";
import { authenticateActiveAccount } from "./_shared/authenticated-account.ts";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

type Account = { uid: string };
type Access = { role: WorkspaceRole };
type CreateResult = { kind: "created"; qrCode: QrCodeSummary } | { kind: "limit"; limit: number };
type Dependencies = {
  authenticate: (token: string) => Promise<Account | null>;
  authorizeWorkspace: (account: Account, workspaceId: string) => Promise<Access | null>;
  listQrCodes: (account: Account, workspaceId: string) => Promise<QrCodeSummary[]>;
  createQrCode: (account: Account, workspaceId: string, input: Input) => Promise<CreateResult>;
  updateQrCode: (account: Account, workspaceId: string, qrCodeId: string, input: Input & { expectedRevision: number }) => Promise<{ kind: "updated"; qrCode: QrCodeSummary } | { kind: "conflict"; qrCode: QrCodeSummary } | { kind: "missing" }>;
};
type Input = { name: string; kind: QrCodeKind; value: string; color: string; version: number; logoScale?: number; iconId?: string | null };
const headers = { "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function token(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() || null : null;
}
function route(request: Request): { workspaceId: string; qrCodeId: string | null } | null {
  const url = new URL(request.url);
  const query = url.searchParams.get("workspaceId")?.trim();
  const queryCode = url.searchParams.get("qrCodeId")?.trim() || null;
  if (query) return { workspaceId: query, qrCodeId: queryCode };
  const match = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/qr-codes(?:\/([^/]+))?$/);
  try { const workspaceId = match?.[1] ? decodeURIComponent(match[1]).trim() : ""; const qrCodeId = match?.[2] ? decodeURIComponent(match[2]).trim() : null; return workspaceId ? { workspaceId, qrCodeId } : null; } catch { return null; }
}
function updateInput(body: unknown): body is Input & { expectedRevision: number } { return input(body) && "expectedRevision" in body && Number.isSafeInteger(body.expectedRevision) && Number(body.expectedRevision) > 0; }
function input(body: unknown): body is Input {
  return typeof body === "object" && body !== null &&
    "name" in body && typeof body.name === "string" &&
    "kind" in body && typeof body.kind === "string" && QR_CODE_KINDS.includes(body.kind as QrCodeKind) &&
    "value" in body && typeof body.value === "string" &&
    "color" in body && typeof body.color === "string" &&
    "version" in body && Number.isSafeInteger(body.version) &&
    (!("logoScale" in body) || (typeof body.logoScale === "number" && body.logoScale >= 0.1 && body.logoScale <= 0.5)) &&
    (!("iconId" in body) || body.iconId === null || typeof body.iconId === "string");
}
export function createQrCodeHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const idToken = token(request);
    if (!idToken) return json({ error: "Authentication required." }, 401);
    const account = await deps.authenticate(idToken);
    if (!account) return json({ error: "Authentication required." }, 401);
    const currentRoute = route(request);
    if (!currentRoute) return json({ error: "A workspace is required." }, 400);
    const { workspaceId, qrCodeId } = currentRoute;
    const access = await deps.authorizeWorkspace(account, workspaceId);
    if (!access) return json({ error: "Workspace access denied." }, 403);
    if (request.method === "GET" && qrCodeId === null) return json({ qrCodes: await deps.listQrCodes(account, workspaceId) });
    if (access.role === "viewer") return json({ error: "Editing access required." }, 403);
    const body: unknown = await request.json().catch(() => null);
    if (request.method === "POST" && qrCodeId === null) { if (!input(body)) return json({ error: "Valid QR code settings are required." }, 400); const result = await deps.createQrCode(account, workspaceId, body); return result.kind === "limit" ? json({ status: "limit_reached", limit: result.limit }, 409) : json({ qrCode: result.qrCode }, 201); }
    if (request.method === "PATCH" && qrCodeId !== null) { if (!updateInput(body)) return json({ error: "Valid QR code settings are required." }, 400); const result = await deps.updateQrCode(account, workspaceId, qrCodeId, body); return result.kind === "missing" ? json({ error: "QR code not found." }, 404) : result.kind === "conflict" ? json({ status: "conflict", qrCode: result.qrCode }, 409) : json({ qrCode: result.qrCode }); }
    return json({ error: "Method not allowed." }, 405);
  };
}
function role(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && WORKSPACE_ROLES.includes(value as WorkspaceRole);
}
function summary(snapshot: DocumentSnapshot): QrCodeSummary | null {
  const name = snapshot.get("name"), content = snapshot.get("content"), color = snapshot.get("color"), version = snapshot.get("version"), revision = snapshot.get("revision") ?? 1, storedKind = snapshot.get("kind"), iconId = snapshot.get("iconId") ?? null, iconName = snapshot.get("iconName") ?? null, logoScale = snapshot.get("logoScale");
  const kind: QrCodeKind = QR_CODE_KINDS.includes(storedKind as QrCodeKind) ? storedKind as QrCodeKind : typeof content === "string" && content.startsWith("mailto:") ? "email" : typeof content === "string" && content.startsWith("tel:") ? "phone" : typeof content === "string" && content.startsWith("WIFI:") ? "wifi" : typeof content === "string" && /^https?:\/\//i.test(content) ? "url" : "text";
  return snapshot.exists && snapshot.get("status") === "active" && typeof name === "string" && typeof content === "string" && typeof color === "string" && Number.isSafeInteger(version) && Number.isSafeInteger(revision)
    ? { id: snapshot.id, name, content, kind, iconId, iconName, color, version, logoScale: typeof logoScale === "number" && logoScale >= 0.1 && logoScale <= 0.5 ? logoScale : 0.25, revision, scanCount: Number.isSafeInteger(snapshot.get("scanCount")) ? snapshot.get("scanCount") : 0 } : null;
}
const production: Dependencies = {
  authenticate: authenticateActiveAccount,
  async authorizeWorkspace(account, workspaceId) {
    const db = getFirestore(getFirebaseAdminApp());
    const [workspace, membership] = await db.getAll(db.doc(`workspaces/${workspaceId}`), db.doc(`workspaceMemberships/${workspaceId}_${account.uid}`));
    const memberRole = membership.get("role");
    return workspace.exists && workspace.get("status") === "active" && membership.exists && membership.get("status") === "active" && role(memberRole) ? { role: memberRole } : null;
  },
  async listQrCodes(_account, workspaceId) {
    const docs = await getFirestore(getFirebaseAdminApp()).collection(`workspaces/${workspaceId}/qrCodes`).orderBy("updatedAt", "desc").get();
    return docs.docs.flatMap((doc) => { const value = summary(doc); return value ? [value] : []; });
  },
  async createQrCode(account, workspaceId, requested) {
    const db = getFirestore(getFirebaseAdminApp()), workspace = db.doc(`workspaces/${workspaceId}`), member = db.doc(`workspaceMemberships/${workspaceId}_${account.uid}`), code = workspace.collection("qrCodes").doc(), activity = workspace.collection("activity").doc();
    return db.runTransaction(async (transaction) => {
      const [workspaceSnapshot, membershipSnapshot] = await Promise.all([transaction.get(workspace), transaction.get(member)]);
      const memberRole = membershipSnapshot.get("role");
      if (!workspaceSnapshot.exists || workspaceSnapshot.get("status") !== "active" || !membershipSnapshot.exists || membershipSnapshot.get("status") !== "active" || !role(memberRole) || memberRole === "viewer") throw new Error("Workspace editing access is unavailable.");
      const decision = decideQrCodeCreation({ qrCodeCount: workspaceSnapshot.get("qrCodeCount") ?? 0, requestedName: requested.name, kind: requested.kind, value: requested.value, color: requested.color, version: requested.version });
      if (decision.kind === "limit") return decision;
      const icon = requested.iconId ? await transaction.get(workspace.collection("icons").doc(requested.iconId)) : null;
      if (icon && (!icon.exists || icon.get("status") !== "active" || typeof icon.get("name") !== "string")) throw new Error("The selected icon is unavailable.");
      const now = FieldValue.serverTimestamp();
      transaction.update(workspace, { qrCodeCount: decision.nextQrCodeCount, updatedAt: now });
      const logoScale = requested.logoScale ?? 0.25;
      transaction.set(code, { name: decision.name, content: decision.content, kind: requested.kind, iconId: icon?.id ?? null, iconName: icon?.get("name") ?? null, color: decision.color, version: decision.version, logoScale, revision: 1, status: "active", workspaceId, createdAt: now, createdBy: account.uid, updatedAt: now });
      transaction.set(activity, { type: "qr-code.created", actorUid: account.uid, createdAt: now, resourceId: code.id, resourceName: decision.name, resourceType: "qr-code", workspaceId });
      return { kind: "created" as const, qrCode: { id: code.id, name: decision.name, content: decision.content, kind: requested.kind, iconId: icon?.id ?? null, iconName: icon?.get("name") ?? null, color: decision.color, version: decision.version, logoScale, revision: 1 } };
    });
  },
  async updateQrCode(account, workspaceId, qrCodeId, requested) {
    const db = getFirestore(getFirebaseAdminApp()), workspace = db.doc(`workspaces/${workspaceId}`), member = db.doc(`workspaceMemberships/${workspaceId}_${account.uid}`), code = workspace.collection("qrCodes").doc(qrCodeId), activity = workspace.collection("activity").doc();
    return db.runTransaction(async (transaction) => { const [membership, codeSnapshot] = await Promise.all([transaction.get(member), transaction.get(code)]); const memberRole = membership.get("role"); if (!membership.exists || membership.get("status") !== "active" || !role(memberRole) || memberRole === "viewer") throw new Error("Workspace editing access is unavailable."); const current = summary(codeSnapshot); if (!current) return { kind: "missing" as const }; if (current.revision !== requested.expectedRevision) return { kind: "conflict" as const, qrCode: current }; const icon = requested.iconId ? await transaction.get(workspace.collection("icons").doc(requested.iconId)) : null; if (icon && (!icon.exists || icon.get("status") !== "active" || typeof icon.get("name") !== "string")) throw new Error("The selected icon is unavailable."); const decision = decideQrCodeCreation({ qrCodeCount: 0, requestedName: requested.name, kind: requested.kind, value: requested.value, color: requested.color, version: requested.version }); if (decision.kind === "limit") throw new Error("QR code limit is unavailable."); const revision = current.revision + 1, now = FieldValue.serverTimestamp(), logoScale = requested.logoScale ?? 0.25; transaction.update(code, { name: decision.name, content: decision.content, kind: requested.kind, iconId: icon?.id ?? null, iconName: icon?.get("name") ?? null, color: decision.color, version: decision.version, logoScale, revision, updatedAt: now, updatedBy: account.uid }); transaction.update(workspace, { updatedAt: now }); transaction.set(activity, { type: "qr-code.updated", actorUid: account.uid, createdAt: now, resourceId: code.id, resourceName: decision.name, resourceType: "qr-code", workspaceId }); return { kind: "updated" as const, qrCode: { id: code.id, name: decision.name, content: decision.content, kind: requested.kind, iconId: icon?.id ?? null, iconName: icon?.get("name") ?? null, color: decision.color, version: decision.version, logoScale, revision } }; });
  },
};
const handler = createQrCodeHandler(production);
export default async function qrCodes(request: Request) {
  try { return await handler(request); } catch (error) { console.error("QR code request failed.", error); return json({ error: "QR code access is unavailable." }, 503); }
}
