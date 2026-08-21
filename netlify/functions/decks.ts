import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  DECK_PUBLICATION_STATUSES,
  type DeckSummary,
} from "../../lib/decks/api-response.ts";
import { decideDeckCreation } from "../../lib/decks/creation.ts";
import {
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from "../../lib/workspaces/api-response.ts";
import { authenticateActiveAccount } from "./_shared/authenticated-account.ts";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

export type AuthenticatedDeckAccount = { uid: string };
export type WorkspaceDeckAccess = { role: WorkspaceRole };

export type DeckCreationResult =
  | { kind: "created"; deck: DeckSummary }
  | { kind: "limit"; limit: number };

export type DeckHandlerDependencies = {
  authenticate: (idToken: string) => Promise<AuthenticatedDeckAccount | null>;
  authorizeWorkspace: (
    account: AuthenticatedDeckAccount,
    workspaceId: string,
  ) => Promise<WorkspaceDeckAccess | null>;
  createDeck: (
    account: AuthenticatedDeckAccount,
    workspaceId: string,
    requestedName: string,
  ) => Promise<DeckCreationResult>;
  listDecks: (
    account: AuthenticatedDeckAccount,
    workspaceId: string,
  ) => Promise<DeckSummary[]>;
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

  const match = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/decks$/);
  if (!match?.[1]) return null;
  try {
    const workspaceId = decodeURIComponent(match[1]).trim();
    return workspaceId.length > 0 ? workspaceId : null;
  } catch {
    return null;
  }
}

export function createDeckHandler(dependencies: DeckHandlerDependencies) {
  return async function deckHandler(request: Request): Promise<Response> {
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

    if (request.method === "GET") {
      const decks = await dependencies.listDecks(account, workspaceId);
      return jsonResponse({ decks });
    }

    if (request.method === "POST") {
      if (access.role === "viewer") {
        return jsonResponse({ error: "Editing access required." }, 403);
      }

      const body: unknown = await request.json().catch(() => null);
      if (
        typeof body !== "object" ||
        body === null ||
        !("name" in body) ||
        typeof body.name !== "string" ||
        body.name.trim().length === 0
      ) {
        return jsonResponse({ error: "A deck name is required." }, 400);
      }

      const result = await dependencies.createDeck(
        account,
        workspaceId,
        body.name,
      );
      if (result.kind === "limit") {
        return jsonResponse(
          { status: "limit_reached", limit: result.limit },
          409,
        );
      }
      return jsonResponse({ deck: result.deck }, 201);
    }

    return jsonResponse({ error: "Method not allowed." }, 405);
  };
}

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return (
    typeof value === "string" &&
    WORKSPACE_ROLES.includes(value as WorkspaceRole)
  );
}

function isEditingRole(role: WorkspaceRole): boolean {
  return role !== "viewer";
}

const productionDependencies: DeckHandlerDependencies = {
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

  async listDecks(_account, workspaceId) {
    const snapshots = await getFirestore(getFirebaseAdminApp())
      .collection(`workspaces/${workspaceId}/decks`)
      .orderBy("updatedAt", "desc")
      .get();

    return snapshots.docs.flatMap((snapshot) => {
      const name = snapshot.get("name");
      const publicationStatus = snapshot.get("publicationStatus");
      const defaultDisplayDurationSeconds = snapshot.get(
        "defaultDisplayDurationSeconds",
      );
      const slideCount = snapshot.get("slideCount");
      if (
        snapshot.get("status") !== "active" ||
        typeof name !== "string" ||
        name.length === 0 ||
        typeof publicationStatus !== "string" ||
        !DECK_PUBLICATION_STATUSES.includes(
          publicationStatus as DeckSummary["publicationStatus"],
        ) ||
        !Number.isSafeInteger(defaultDisplayDurationSeconds) ||
        defaultDisplayDurationSeconds <= 0 ||
        !Number.isSafeInteger(slideCount) ||
        slideCount < 0
      ) {
        return [];
      }

      return [
        {
          id: snapshot.id,
          name,
          publicationStatus: publicationStatus as DeckSummary["publicationStatus"],
          defaultDisplayDurationSeconds,
          slideCount,
        },
      ];
    });
  },

  async createDeck(account, workspaceId, requestedName) {
    const firestore = getFirestore(getFirebaseAdminApp());
    const workspaceRef = firestore.doc(`workspaces/${workspaceId}`);
    const membershipRef = firestore.doc(
      `workspaceMemberships/${workspaceId}_${account.uid}`,
    );
    const deckRef = workspaceRef.collection("decks").doc();
    const activityRef = workspaceRef.collection("activity").doc();

    return firestore.runTransaction(async (transaction) => {
      const membershipSnapshot = await transaction.get(membershipRef);
      const workspaceSnapshot = await transaction.get(workspaceRef);
      const role = membershipSnapshot.get("role");
      if (
        !membershipSnapshot.exists ||
        membershipSnapshot.get("status") !== "active" ||
        !isWorkspaceRole(role) ||
        !isEditingRole(role) ||
        !workspaceSnapshot.exists ||
        workspaceSnapshot.get("status") !== "active"
      ) {
        throw new Error("Workspace editing access is unavailable.");
      }

      const decision = decideDeckCreation({
        deckCount: workspaceSnapshot.get("deckCount") ?? 0,
        requestedName,
      });
      if (decision.kind === "limit") return decision;

      const now = FieldValue.serverTimestamp();
      transaction.update(workspaceRef, {
        deckCount: decision.nextDeckCount,
        updatedAt: now,
      });
      transaction.set(deckRef, {
        createdAt: now,
        createdBy: account.uid,
        defaultDisplayDurationSeconds:
          decision.defaultDisplayDurationSeconds,
        name: decision.name,
        publicationStatus: "draft",
        slideCount: 0,
        status: "active",
        updatedAt: now,
        workspaceId,
      });
      transaction.set(activityRef, {
        actorUid: account.uid,
        createdAt: now,
        resourceId: deckRef.id,
        resourceName: decision.name,
        resourceType: "deck",
        type: "deck.created",
        workspaceId,
      });

      return {
        kind: "created" as const,
        deck: {
          id: deckRef.id,
          name: decision.name,
          publicationStatus: "draft" as const,
          defaultDisplayDurationSeconds:
            decision.defaultDisplayDurationSeconds,
          slideCount: 0,
        },
      };
    });
  },
};

const productionHandler = createDeckHandler(productionDependencies);

export default async function handler(request: Request): Promise<Response> {
  try {
    return await productionHandler(request);
  } catch (error) {
    console.error("Deck request failed.", error);
    return jsonResponse({ error: "Deck access is unavailable." }, 503);
  }
}
