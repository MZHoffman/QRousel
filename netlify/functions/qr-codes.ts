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
};
type Input = { name: string; kind: QrCodeKind; value: string; color: string; version: number };
const headers = { "content-type": "application/json; charset=utf-8" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function token(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7).trim() || null : null;
}
function route(request: Request): string | null {
  const url = new URL(request.url);
  const query = url.searchParams.get("workspaceId")?.trim();
  if (query) return query;
  const match = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/qr-codes$/);
  try { return match?.[1] ? decodeURIComponent(match[1]).trim() || null : null; } catch { return null; }
}
function input(body: unknown): body is Input {
  return typeof body === "object" && body !== null &&
    "name" in body && typeof body.name === "string" &&
    "kind" in body && typeof body.kind === "string" && QR_CODE_KINDS.includes(body.kind as QrCodeKind) &&
    "value" in body && typeof body.value === "string" &&
    "color" in body && typeof body.color === "string" &&
    "version" in body && Number.isSafeInteger(body.version);
}
export function createQrCodeHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    const idToken = token(request);
    if (!idToken) return json({ error: "Authentication required." }, 401);
    const account = await deps.authenticate(idToken);
    if (!account) return json({ error: "Authentication required." }, 401);
    const workspaceId = route(request);
    if (!workspaceId) return json({ error: "A workspace is required." }, 400);
    const access = await deps.authorizeWorkspace(account, workspaceId);
    if (!access) return json({ error: "Workspace access denied." }, 403);
    if (request.method === "GET") return json({ qrCodes: await deps.listQrCodes(account, workspaceId) });
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
    if (access.role === "viewer") return json({ error: "Editing access required." }, 403);
    const body: unknown = await request.json().catch(() => null);
    if (!input(body)) return json({ error: "Valid QR code settings are required." }, 400);
    const result = await deps.createQrCode(account, workspaceId, body);
    return result.kind === "limit"
      ? json({ status: "limit_reached", limit: result.limit }, 409)
      : json({ qrCode: result.qrCode }, 201);
  };
}
function role(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && WORKSPACE_ROLES.includes(value as WorkspaceRole);
}
function summary(snapshot: DocumentSnapshot): QrCodeSummary | null {
  const name = snapshot.get("name"), content = snapshot.get("content"), color = snapshot.get("color"), version = snapshot.get("version"), revision = snapshot.get("revision") ?? 1;
  return snapshot.exists && snapshot.get("status") === "active" && typeof name === "string" && typeof content === "string" && typeof color === "string" && Number.isSafeInteger(version) && Number.isSafeInteger(revision)
    ? { id: snapshot.id, name, content, color, version, revision } : null;
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
      const now = FieldValue.serverTimestamp();
      transaction.update(workspace, { qrCodeCount: decision.nextQrCodeCount, updatedAt: now });
      transaction.set(code, { name: decision.name, content: decision.content, color: decision.color, version: decision.version, revision: 1, status: "active", workspaceId, createdAt: now, createdBy: account.uid, updatedAt: now });
      transaction.set(activity, { type: "qr-code.created", actorUid: account.uid, createdAt: now, resourceId: code.id, resourceName: decision.name, resourceType: "qr-code", workspaceId });
      return { kind: "created" as const, qrCode: { id: code.id, name: decision.name, content: decision.content, color: decision.color, version: decision.version, revision: 1 } };
    });
  },
};
const handler = createQrCodeHandler(production);
export default async function qrCodes(request: Request) {
  try { return await handler(request); } catch (error) { console.error("QR code request failed.", error); return json({ error: "QR code access is unavailable." }, 503); }
}
