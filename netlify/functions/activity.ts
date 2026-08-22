import {
  FieldPath,
  getFirestore,
  Timestamp,
  type DocumentSnapshot,
} from "firebase-admin/firestore";
import {
  WORKSPACE_ACTIVITY_TYPES,
  type ActivityListResponse,
  type WorkspaceActivityEntry,
  type WorkspaceActivityType,
} from "../../lib/activity/api-response.ts";
import {
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from "../../lib/workspaces/api-response.ts";
import { authenticateActiveAccount } from "./_shared/authenticated-account.ts";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

export type AuthenticatedActivityAccount = { uid: string };
export type WorkspaceActivityAccess = { role: WorkspaceRole };

export type ActivityHandlerDependencies = {
  authenticate: (
    idToken: string,
  ) => Promise<AuthenticatedActivityAccount | null>;
  authorizeWorkspace: (
    account: AuthenticatedActivityAccount,
    workspaceId: string,
  ) => Promise<WorkspaceActivityAccess | null>;
  listActivity: (
    workspaceId: string,
    cursor: string | null,
  ) => Promise<ActivityListResponse>;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS,
  });
}

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function readWorkspaceId(request: Request): string | null {
  const url = new URL(request.url);
  const queryId = url.searchParams.get("workspaceId")?.trim();
  if (queryId) return queryId;

  const match = url.pathname.match(
    /^\/api\/workspaces\/([^/]+)\/activity$/,
  );
  if (!match?.[1]) return null;
  try {
    const workspaceId = decodeURIComponent(match[1]).trim();
    return workspaceId.length > 0 ? workspaceId : null;
  } catch {
    return null;
  }
}

export function createActivityHandler(
  dependencies: ActivityHandlerDependencies,
) {
  return async function activityHandler(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed." }, 405);
    }

    const idToken = readBearerToken(request);
    if (idToken === null) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const account = await dependencies.authenticate(idToken);
    if (account === null) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const workspaceId = readWorkspaceId(request);
    if (workspaceId === null) {
      return jsonResponse({ error: "A workspace is required." }, 400);
    }

    const access = await dependencies.authorizeWorkspace(account, workspaceId);
    if (access === null) {
      return jsonResponse({ error: "Workspace access denied." }, 403);
    }

    const cursor = new URL(request.url).searchParams.get("cursor") || null;
    return jsonResponse(await dependencies.listActivity(workspaceId, cursor));
  };
}

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return (
    typeof value === "string" &&
    WORKSPACE_ROLES.includes(value as WorkspaceRole)
  );
}

function actorNameFromSnapshot(snapshot: DocumentSnapshot): string {
  const displayName = snapshot.get("displayName");
  if (typeof displayName === "string" && displayName.trim().length > 0) {
    return displayName.trim();
  }
  const email = snapshot.get("email");
  return typeof email === "string" && email.trim().length > 0
    ? email.trim()
    : "Former member";
}

function activityEntryFromSnapshot(
  snapshot: DocumentSnapshot,
  actorName: string,
): WorkspaceActivityEntry | null {
  const type = snapshot.get("type");
  const actorUid = snapshot.get("actorUid");
  const createdAt = snapshot.get("createdAt");
  const resourceId = snapshot.get("resourceId");
  const resourceName = snapshot.get("resourceName");
  const resourceType = snapshot.get("resourceType");
  const changedFields = snapshot.get("changedFields");
  if (
    typeof type !== "string" ||
    !WORKSPACE_ACTIVITY_TYPES.includes(type as WorkspaceActivityType) ||
    typeof actorUid !== "string" ||
    actorUid.length === 0 ||
    !(createdAt instanceof Timestamp) ||
    typeof resourceId !== "string" ||
    resourceId.length === 0 ||
    (resourceName !== undefined &&
      resourceName !== null &&
      typeof resourceName !== "string") ||
    (resourceType !== "workspace" &&
      resourceType !== "deck" &&
      resourceType !== "slide") ||
    (changedFields !== undefined &&
      (!Array.isArray(changedFields) ||
        !changedFields.every((field) => typeof field === "string")))
  ) {
    return null;
  }

  return {
    id: snapshot.id,
    type: type as WorkspaceActivityType,
    actorUid,
    actorName,
    occurredAt: createdAt.toDate().toISOString(),
    resourceId,
    resourceName:
      typeof resourceName === "string" && resourceName.length > 0
        ? resourceName
        : null,
    resourceType,
    ...(changedFields === undefined ? {} : { changedFields }),
  };
}

type ActivityCursor = { occurredAt: string; id: string };

function parseActivityCursor(value: string): ActivityCursor | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("occurredAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.occurredAt !== "string" ||
      typeof parsed.id !== "string" ||
      parsed.id.length === 0
    ) {
      return null;
    }
    const occurredAt = new Date(parsed.occurredAt);
    return !Number.isNaN(occurredAt.valueOf()) &&
      occurredAt.toISOString() === parsed.occurredAt
      ? { occurredAt: parsed.occurredAt, id: parsed.id }
      : null;
  } catch {
    return null;
  }
}

function encodeActivityCursor(snapshot: DocumentSnapshot): string {
  const createdAt = snapshot.get("createdAt");
  if (!(createdAt instanceof Timestamp)) {
    throw new Error("The activity cursor cannot be created.");
  }
  return Buffer.from(
    JSON.stringify({
      occurredAt: createdAt.toDate().toISOString(),
      id: snapshot.id,
    }),
  ).toString("base64url");
}

const productionDependencies: ActivityHandlerDependencies = {
  authenticate(idToken) {
    return authenticateActiveAccount(idToken);
  },

  async authorizeWorkspace(account, workspaceId) {
    const firestore = getFirestore(getFirebaseAdminApp());
    const [workspaceSnapshot, membershipSnapshot] = await firestore.getAll(
      firestore.doc(`workspaces/${workspaceId}`),
      firestore.doc(`workspaceMemberships/${workspaceId}_${account.uid}`),
    );
    const role = membershipSnapshot.get("role");
    if (
      !workspaceSnapshot.exists ||
      workspaceSnapshot.get("status") !== "active" ||
      !membershipSnapshot.exists ||
      membershipSnapshot.get("status") !== "active" ||
      !isWorkspaceRole(role)
    ) {
      return null;
    }
    return { role };
  },

  async listActivity(workspaceId, cursor) {
    const firestore = getFirestore(getFirebaseAdminApp());
    let query = firestore
      .collection(`workspaces/${workspaceId}/activity`)
      .orderBy("createdAt", "desc")
      .orderBy(FieldPath.documentId())
      .limit(25);
    if (cursor !== null) {
      const parsedCursor = parseActivityCursor(cursor);
      if (parsedCursor === null) {
        throw new Error("The activity cursor is invalid.");
      }
      query = query.startAfter(
        Timestamp.fromDate(new Date(parsedCursor.occurredAt)),
        parsedCursor.id,
      );
    }
    const snapshots = await query.get();
    const actorUids = [
      ...new Set(
        snapshots.docs.flatMap((snapshot) => {
          const actorUid = snapshot.get("actorUid");
          return typeof actorUid === "string" && actorUid.length > 0
            ? [actorUid]
            : [];
        }),
      ),
    ];
    const accountSnapshots =
      actorUids.length === 0
        ? []
        : await firestore.getAll(
            ...actorUids.map((actorUid) =>
              firestore.doc(`accounts/${actorUid}`),
            ),
          );
    const actorNames = new Map(
      accountSnapshots.map((snapshot) => [
        snapshot.id,
        actorNameFromSnapshot(snapshot),
      ]),
    );

    const activity = snapshots.docs.flatMap((snapshot) => {
      const actorUid = snapshot.get("actorUid");
      if (typeof actorUid !== "string" || actorUid.length === 0) return [];
      const entry = activityEntryFromSnapshot(
        snapshot,
        actorNames.get(actorUid) ?? "Former member",
      );
      return entry === null ? [] : [entry];
    });
    return {
      activity,
      nextCursor:
        snapshots.docs.length === 25
          ? encodeActivityCursor(snapshots.docs.at(-1)!)
          : null,
    };
  },
};

const productionHandler = createActivityHandler(productionDependencies);

export default async function handler(request: Request): Promise<Response> {
  try {
    return await productionHandler(request);
  } catch (error) {
    console.error("Activity request failed.", error);
    return jsonResponse({ error: "Workspace activity is unavailable." }, 503);
  }
}
