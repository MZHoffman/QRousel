import {
  FieldValue,
  getFirestore,
  type DocumentSnapshot,
} from "firebase-admin/firestore";
import {
  DECK_PUBLICATION_STATUSES,
  type DeckSummary,
} from "../../lib/decks/api-response.ts";
import { decideDeckCreation } from "../../lib/decks/creation.ts";
import { decideDeckUpdate } from "../../lib/decks/update.ts";
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

export type DeckUpdateResult =
  | { kind: "updated"; deck: DeckSummary }
  | { kind: "conflict"; deck: DeckSummary }
  | { kind: "missing" };

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
  getDeck: (
    account: AuthenticatedDeckAccount,
    workspaceId: string,
    deckId: string,
  ) => Promise<DeckSummary | null>;
  listDecks: (
    account: AuthenticatedDeckAccount,
    workspaceId: string,
  ) => Promise<DeckSummary[]>;
  updateDeck: (
    account: AuthenticatedDeckAccount,
    workspaceId: string,
    deckId: string,
    input: {
      name: string;
      defaultDisplayDurationSeconds: number;
      expectedVersion: number;
    },
  ) => Promise<DeckUpdateResult>;
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

function readDeckRoute(
  request: Request,
): { workspaceId: string; deckId: string | null } | null {
  const url = new URL(request.url);
  const queryId = url.searchParams.get("workspaceId")?.trim();
  const queryDeckId = url.searchParams.get("deckId")?.trim() || null;
  if (queryId) return { workspaceId: queryId, deckId: queryDeckId };

  const match = url.pathname.match(
    /^\/api\/workspaces\/([^/]+)\/decks(?:\/([^/]+))?$/,
  );
  if (!match?.[1]) return null;
  try {
    const workspaceId = decodeURIComponent(match[1]).trim();
    const deckId = match[2] ? decodeURIComponent(match[2]).trim() : null;
    return workspaceId.length > 0 && (!match[2] || deckId)
      ? { workspaceId, deckId }
      : null;
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

    const route = readDeckRoute(request);
    if (route === null) {
      return jsonResponse({ error: "A workspace is required." }, 400);
    }
    const { workspaceId, deckId } = route;

    const access = await dependencies.authorizeWorkspace(account, workspaceId);
    if (access === null) {
      return jsonResponse({ error: "Workspace access denied." }, 403);
    }

    if (request.method === "GET") {
      if (deckId !== null) {
        const deck = await dependencies.getDeck(account, workspaceId, deckId);
        return deck === null
          ? jsonResponse({ error: "Deck not found." }, 404)
          : jsonResponse({ deck });
      }
      const decks = await dependencies.listDecks(account, workspaceId);
      return jsonResponse({ decks });
    }

    if (request.method === "POST" && deckId === null) {
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

    if (request.method === "PATCH" && deckId !== null) {
      if (access.role === "viewer") {
        return jsonResponse({ error: "Editing access required." }, 403);
      }

      const body: unknown = await request.json().catch(() => null);
      if (
        typeof body !== "object" ||
        body === null ||
        !("name" in body) ||
        typeof body.name !== "string" ||
        body.name.trim().length === 0 ||
        !("defaultDisplayDurationSeconds" in body) ||
        !Number.isSafeInteger(body.defaultDisplayDurationSeconds) ||
        Number(body.defaultDisplayDurationSeconds) < 1 ||
        !("expectedVersion" in body) ||
        !Number.isSafeInteger(body.expectedVersion) ||
        Number(body.expectedVersion) < 1
      ) {
        return jsonResponse({ error: "Valid deck settings are required." }, 400);
      }

      const result = await dependencies.updateDeck(
        account,
        workspaceId,
        deckId,
        {
          name: body.name,
          defaultDisplayDurationSeconds: Number(
            body.defaultDisplayDurationSeconds,
          ),
          expectedVersion: Number(body.expectedVersion),
        },
      );
      if (result.kind === "missing") {
        return jsonResponse({ error: "Deck not found." }, 404);
      }
      if (result.kind === "conflict") {
        return jsonResponse(
          { status: "conflict", deck: result.deck },
          409,
        );
      }
      return jsonResponse({ deck: result.deck });
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

function deckSummaryFromSnapshot(
  snapshot: DocumentSnapshot,
): DeckSummary | null {
  const name = snapshot.get("name");
  const publicationStatus = snapshot.get("publicationStatus");
  const defaultDisplayDurationSeconds = snapshot.get(
    "defaultDisplayDurationSeconds",
  );
  const slideCount = snapshot.get("slideCount");
  const version = snapshot.get("version") ?? 1;
  if (
    !snapshot.exists ||
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
    slideCount < 0 ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    return null;
  }

  return {
    id: snapshot.id,
    name,
    publicationStatus: publicationStatus as DeckSummary["publicationStatus"],
    defaultDisplayDurationSeconds,
    slideCount,
    version,
  };
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
      const deck = deckSummaryFromSnapshot(snapshot);
      return deck === null ? [] : [deck];
    });
  },

  async getDeck(_account, workspaceId, deckId) {
    const snapshot = await getFirestore(getFirebaseAdminApp())
      .doc(`workspaces/${workspaceId}/decks/${deckId}`)
      .get();
    return deckSummaryFromSnapshot(snapshot);
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
        version: 1,
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
          version: 1,
        },
      };
    });
  },

  async updateDeck(account, workspaceId, deckId, input) {
    const firestore = getFirestore(getFirebaseAdminApp());
    const workspaceRef = firestore.doc(`workspaces/${workspaceId}`);
    const membershipRef = firestore.doc(
      `workspaceMemberships/${workspaceId}_${account.uid}`,
    );
    const deckRef = workspaceRef.collection("decks").doc(deckId);
    const activityRef = workspaceRef.collection("activity").doc();

    return firestore.runTransaction(async (transaction) => {
      const membershipSnapshot = await transaction.get(membershipRef);
      const workspaceSnapshot = await transaction.get(workspaceRef);
      const deckSnapshot = await transaction.get(deckRef);
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

      if (!deckSnapshot.exists || deckSnapshot.get("status") !== "active") {
        return { kind: "missing" as const };
      }
      const currentDeck = deckSummaryFromSnapshot(deckSnapshot);
      if (currentDeck === null) {
        throw new Error("The stored deck is invalid.");
      }

      const decision = decideDeckUpdate({
        currentVersion: currentDeck.version,
        expectedVersion: input.expectedVersion,
        requestedName: input.name,
        requestedDefaultDisplayDurationSeconds:
          input.defaultDisplayDurationSeconds,
      });
      if (decision.kind === "conflict") {
        return { kind: "conflict" as const, deck: currentDeck };
      }

      const changedFields = [
        ...(decision.name === currentDeck.name ? [] : ["name"]),
        ...(decision.defaultDisplayDurationSeconds ===
        currentDeck.defaultDisplayDurationSeconds
          ? []
          : ["defaultDisplayDurationSeconds"]),
      ];
      const now = FieldValue.serverTimestamp();
      transaction.update(deckRef, {
        defaultDisplayDurationSeconds:
          decision.defaultDisplayDurationSeconds,
        name: decision.name,
        updatedAt: now,
        updatedBy: account.uid,
        version: decision.nextVersion,
      });
      transaction.update(workspaceRef, { updatedAt: now });
      transaction.set(activityRef, {
        actorUid: account.uid,
        changedFields,
        createdAt: now,
        previousVersion: currentDeck.version,
        resourceId: deckId,
        resourceName: decision.name,
        resourceType: "deck",
        type: "deck.updated",
        version: decision.nextVersion,
        workspaceId,
      });

      return {
        kind: "updated" as const,
        deck: {
          ...currentDeck,
          name: decision.name,
          defaultDisplayDurationSeconds:
            decision.defaultDisplayDurationSeconds,
          version: decision.nextVersion,
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
