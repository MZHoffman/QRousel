import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { WorkspaceSummary } from "../../lib/workspaces/api-response.ts";
import { decideWorkspaceCreation } from "../../lib/workspaces/creation.ts";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

export type AuthenticatedWorkspaceAccount = {
  uid: string;
};

export type WorkspaceCreationResult =
  | {
      kind: "created";
      workspace: WorkspaceSummary;
    }
  | {
      kind: "limit";
      limit: number;
    };

export type WorkspaceHandlerDependencies = {
  authenticate: (
    idToken: string,
  ) => Promise<AuthenticatedWorkspaceAccount | null>;
  createWorkspace: (
    account: AuthenticatedWorkspaceAccount,
    requestedName: string,
  ) => Promise<WorkspaceCreationResult>;
  listWorkspaces: (
    account: AuthenticatedWorkspaceAccount,
  ) => Promise<WorkspaceSummary[]>;
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

export function createWorkspaceHandler(dependencies: WorkspaceHandlerDependencies) {
  return async function workspaceHandler(request: Request): Promise<Response> {
    const idToken = readBearerToken(request);
    if (idToken === null) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const account = await dependencies.authenticate(idToken);
    if (account === null) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    if (request.method === "GET") {
      const workspaces = await dependencies.listWorkspaces(account);
      return jsonResponse({ workspaces });
    }

    if (request.method === "POST") {
      const body: unknown = await request.json().catch(() => null);
      if (
        typeof body !== "object" ||
        body === null ||
        !("name" in body) ||
        typeof body.name !== "string" ||
        body.name.trim().length === 0
      ) {
        return jsonResponse({ error: "A workspace name is required." }, 400);
      }

      const result = await dependencies.createWorkspace(account, body.name);
      if (result.kind === "limit") {
        return jsonResponse(
          { status: "limit_reached", limit: result.limit },
          409,
        );
      }

      return jsonResponse({ workspace: result.workspace }, 201);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  };
}

function isGoogleIdentity(token: DecodedIdToken): boolean {
  return (
    token.firebase.sign_in_provider === "google.com" &&
    token.email_verified === true &&
    typeof token.email === "string"
  );
}

const productionDependencies: WorkspaceHandlerDependencies = {
  async authenticate(idToken) {
    const token = await getAuth(getFirebaseAdminApp()).verifyIdToken(
      idToken,
      true,
    );
    if (!isGoogleIdentity(token)) return null;

    const accountSnapshot = await getFirestore(getFirebaseAdminApp())
      .doc(`accounts/${token.uid}`)
      .get();
    if (
      !accountSnapshot.exists ||
      accountSnapshot.get("status") !== "active"
    ) {
      return null;
    }

    return { uid: token.uid };
  },

  async listWorkspaces(account) {
    const firestore = getFirestore(getFirebaseAdminApp());
    const membershipSnapshots = await firestore
      .collection("workspaceMemberships")
      .where("accountUid", "==", account.uid)
      .get();

    if (membershipSnapshots.empty) return [];

    const memberships = membershipSnapshots.docs.map((snapshot) => ({
      role: snapshot.get("role") as WorkspaceSummary["role"],
      workspaceId: snapshot.get("workspaceId") as string,
    }));
    const workspaceSnapshots = await firestore.getAll(
      ...memberships.map(({ workspaceId }) =>
        firestore.doc(`workspaces/${workspaceId}`),
      ),
    );

    return workspaceSnapshots.flatMap((snapshot, index) => {
      const membership = memberships[index];
      const name = snapshot.get("name");
      if (
        !snapshot.exists ||
        snapshot.get("status") !== "active" ||
        typeof name !== "string" ||
        membership === undefined
      ) {
        return [];
      }

      return [
        {
          id: snapshot.id,
          name,
          role: membership.role,
        },
      ];
    });
  },

  async createWorkspace(account, requestedName) {
    const firestore = getFirestore(getFirebaseAdminApp());
    const accountRef = firestore.doc(`accounts/${account.uid}`);
    const workspaceRef = firestore.collection("workspaces").doc();
    const membershipRef = firestore.doc(
      `workspaceMemberships/${workspaceRef.id}_${account.uid}`,
    );
    const activityRef = workspaceRef.collection("activity").doc();

    return firestore.runTransaction(async (transaction) => {
      const accountSnapshot = await transaction.get(accountRef);
      if (
        !accountSnapshot.exists ||
        accountSnapshot.get("status") !== "active"
      ) {
        throw new Error("The account is not active.");
      }

      const storedCount = accountSnapshot.get("createdWorkspaceCount") ?? 0;
      const decision = decideWorkspaceCreation({
        createdWorkspaceCount: storedCount,
        requestedName,
      });
      if (decision.kind === "limit") return decision;

      const now = FieldValue.serverTimestamp();
      transaction.update(accountRef, {
        createdWorkspaceCount: decision.nextCreatedWorkspaceCount,
        updatedAt: now,
      });
      transaction.set(workspaceRef, {
        createdAt: now,
        createdBy: account.uid,
        founderUid: account.uid,
        name: decision.name,
        status: "active",
        updatedAt: now,
      });
      transaction.set(membershipRef, {
        accountUid: account.uid,
        createdAt: now,
        role: "founder",
        status: "active",
        workspaceId: workspaceRef.id,
      });
      transaction.set(activityRef, {
        actorUid: account.uid,
        createdAt: now,
        resourceId: workspaceRef.id,
        resourceType: "workspace",
        type: "workspace.created",
        workspaceId: workspaceRef.id,
      });

      return {
        kind: "created" as const,
        workspace: {
          id: workspaceRef.id,
          name: decision.name,
          role: "founder" as const,
        },
      };
    });
  },
};

const productionHandler = createWorkspaceHandler(productionDependencies);

export default async function handler(request: Request): Promise<Response> {
  try {
    return await productionHandler(request);
  } catch (error) {
    console.error("Workspace request failed.", error);
    return jsonResponse({ error: "Workspace access is unavailable." }, 503);
  }
}
