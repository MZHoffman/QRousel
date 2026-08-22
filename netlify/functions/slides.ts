import {
  FieldValue,
  getFirestore,
  type DocumentSnapshot,
} from "firebase-admin/firestore";
import type { SlideSummary } from "../../lib/slides/api-response.ts";
import { decideSlideCreation } from "../../lib/slides/creation.ts";
import {
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from "../../lib/workspaces/api-response.ts";
import { authenticateActiveAccount } from "./_shared/authenticated-account.ts";
import { getFirebaseAdminApp } from "./_shared/firebase-admin.ts";

export type AuthenticatedSlideAccount = { uid: string };
export type WorkspaceSlideAccess = { role: WorkspaceRole };

export type SlideCreationResult =
  | { kind: "created"; slide: SlideSummary }
  | { kind: "limit"; limit: number };

export type SlideUpdateResult =
  | { kind: "updated"; slide: SlideSummary }
  | { kind: "conflict"; slide: SlideSummary }
  | { kind: "missing" };

export type SlideHandlerDependencies = {
  authenticate: (
    idToken: string,
  ) => Promise<AuthenticatedSlideAccount | null>;
  authorizeWorkspace: (
    account: AuthenticatedSlideAccount,
    workspaceId: string,
  ) => Promise<WorkspaceSlideAccess | null>;
  createSlide: (
    account: AuthenticatedSlideAccount,
    workspaceId: string,
    input: { title: string; description: string },
  ) => Promise<SlideCreationResult>;
  listSlides: (
    account: AuthenticatedSlideAccount,
    workspaceId: string,
  ) => Promise<SlideSummary[]>;
  updateSlide: (
    account: AuthenticatedSlideAccount,
    workspaceId: string,
    slideId: string,
    input: { title: string; description: string; expectedVersion: number },
  ) => Promise<SlideUpdateResult>;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function readSlideRoute(
  request: Request,
): { workspaceId: string; slideId: string | null } | null {
  const url = new URL(request.url);
  const queryWorkspaceId = url.searchParams.get("workspaceId")?.trim();
  const querySlideId = url.searchParams.get("slideId")?.trim() || null;
  if (queryWorkspaceId) {
    return { workspaceId: queryWorkspaceId, slideId: querySlideId };
  }

  const match = url.pathname.match(
    /^\/api\/workspaces\/([^/]+)\/slides(?:\/([^/]+))?$/,
  );
  if (!match?.[1]) return null;
  try {
    const workspaceId = decodeURIComponent(match[1]).trim();
    const slideId = match[2] ? decodeURIComponent(match[2]).trim() : null;
    return workspaceId.length > 0 && (!match[2] || slideId !== null)
      ? { workspaceId, slideId }
      : null;
  } catch {
    return null;
  }
}

function isSlideInput(
  body: unknown,
): body is { title: string; description: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "title" in body &&
    typeof body.title === "string" &&
    body.title.trim().length > 0 &&
    "description" in body &&
    typeof body.description === "string"
  );
}

function isSlideUpdateInput(
  body: unknown,
): body is { title: string; description: string; expectedVersion: number } {
  return (
    isSlideInput(body) &&
    "expectedVersion" in body &&
    Number.isSafeInteger(body.expectedVersion) &&
    Number(body.expectedVersion) > 0
  );
}

export function createSlideHandler(dependencies: SlideHandlerDependencies) {
  return async function slideHandler(request: Request): Promise<Response> {
    const idToken = readBearerToken(request);
    if (idToken === null) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const account = await dependencies.authenticate(idToken);
    if (account === null) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const route = readSlideRoute(request);
    if (route === null) {
      return jsonResponse({ error: "A workspace is required." }, 400);
    }

    const access = await dependencies.authorizeWorkspace(
      account,
      route.workspaceId,
    );
    if (access === null) {
      return jsonResponse({ error: "Workspace access denied." }, 403);
    }

    if (request.method === "GET" && route.slideId === null) {
      const slides = await dependencies.listSlides(account, route.workspaceId);
      return jsonResponse({ slides });
    }

    if (access.role === "viewer") {
      return jsonResponse({ error: "Editing access required." }, 403);
    }

    if (request.method === "POST" && route.slideId === null) {
      const body: unknown = await request.json().catch(() => null);
      if (!isSlideInput(body)) {
        return jsonResponse(
          { error: "A slide title and description are required." },
          400,
        );
      }

      const result = await dependencies.createSlide(
        account,
        route.workspaceId,
        body,
      );
      if (result.kind === "limit") {
        return jsonResponse(
          { status: "limit_reached", limit: result.limit },
          409,
        );
      }
      return jsonResponse({ slide: result.slide }, 201);
    }

    if (request.method === "PATCH" && route.slideId !== null) {
      const body: unknown = await request.json().catch(() => null);
      if (!isSlideUpdateInput(body)) {
        return jsonResponse({ error: "Valid slide settings are required." }, 400);
      }

      const result = await dependencies.updateSlide(
        account,
        route.workspaceId,
        route.slideId,
        body,
      );
      if (result.kind === "missing") {
        return jsonResponse({ error: "Slide not found." }, 404);
      }
      if (result.kind === "conflict") {
        return jsonResponse({ status: "conflict", slide: result.slide }, 409);
      }
      return jsonResponse({ slide: result.slide });
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

function slideSummaryFromSnapshot(
  snapshot: DocumentSnapshot,
): SlideSummary | null {
  const title = snapshot.get("title");
  const description = snapshot.get("description");
  const version = snapshot.get("version") ?? 1;
  if (
    !snapshot.exists ||
    snapshot.get("status") !== "active" ||
    typeof title !== "string" ||
    title.length === 0 ||
    typeof description !== "string" ||
    !Number.isSafeInteger(version) ||
    version < 1
  ) {
    return null;
  }

  return { id: snapshot.id, title, description, version };
}

const productionDependencies: SlideHandlerDependencies = {
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

  async listSlides(_account, workspaceId) {
    const snapshots = await getFirestore(getFirebaseAdminApp())
      .collection(`workspaces/${workspaceId}/slides`)
      .orderBy("updatedAt", "desc")
      .get();
    return snapshots.docs.flatMap((snapshot) => {
      const slide = slideSummaryFromSnapshot(snapshot);
      return slide === null ? [] : [slide];
    });
  },

  async createSlide(account, workspaceId, input) {
    const firestore = getFirestore(getFirebaseAdminApp());
    const workspaceRef = firestore.doc(`workspaces/${workspaceId}`);
    const membershipRef = firestore.doc(
      `workspaceMemberships/${workspaceId}_${account.uid}`,
    );
    const slideRef = workspaceRef.collection("slides").doc();
    const activityRef = workspaceRef.collection("activity").doc();

    return firestore.runTransaction(async (transaction) => {
      const membershipSnapshot = await transaction.get(membershipRef);
      const workspaceSnapshot = await transaction.get(workspaceRef);
      const role = membershipSnapshot.get("role");
      if (
        !membershipSnapshot.exists ||
        membershipSnapshot.get("status") !== "active" ||
        !isWorkspaceRole(role) ||
        role === "viewer" ||
        !workspaceSnapshot.exists ||
        workspaceSnapshot.get("status") !== "active"
      ) {
        throw new Error("Workspace editing access is unavailable.");
      }

      const decision = decideSlideCreation({
        slideCount: workspaceSnapshot.get("slideCount") ?? 0,
        requestedTitle: input.title,
        requestedDescription: input.description,
      });
      if (decision.kind === "limit") return decision;

      const now = FieldValue.serverTimestamp();
      transaction.update(workspaceRef, {
        slideCount: decision.nextSlideCount,
        updatedAt: now,
      });
      transaction.set(slideRef, {
        createdAt: now,
        createdBy: account.uid,
        description: decision.description,
        status: "active",
        title: decision.title,
        updatedAt: now,
        version: 1,
        workspaceId,
      });
      transaction.set(activityRef, {
        actorUid: account.uid,
        createdAt: now,
        resourceId: slideRef.id,
        resourceName: decision.title,
        resourceType: "slide",
        type: "slide.created",
        workspaceId,
      });
      return {
        kind: "created" as const,
        slide: {
          id: slideRef.id,
          title: decision.title,
          description: decision.description,
          version: 1,
        },
      };
    });
  },

  async updateSlide(account, workspaceId, slideId, input) {
    const firestore = getFirestore(getFirebaseAdminApp());
    const workspaceRef = firestore.doc(`workspaces/${workspaceId}`);
    const membershipRef = firestore.doc(
      `workspaceMemberships/${workspaceId}_${account.uid}`,
    );
    const slideRef = workspaceRef.collection("slides").doc(slideId);
    const activityRef = workspaceRef.collection("activity").doc();

    return firestore.runTransaction(async (transaction) => {
      const membershipSnapshot = await transaction.get(membershipRef);
      const workspaceSnapshot = await transaction.get(workspaceRef);
      const slideSnapshot = await transaction.get(slideRef);
      const role = membershipSnapshot.get("role");
      if (
        !membershipSnapshot.exists ||
        membershipSnapshot.get("status") !== "active" ||
        !isWorkspaceRole(role) ||
        role === "viewer" ||
        !workspaceSnapshot.exists ||
        workspaceSnapshot.get("status") !== "active"
      ) {
        throw new Error("Workspace editing access is unavailable.");
      }

      const currentSlide = slideSummaryFromSnapshot(slideSnapshot);
      if (currentSlide === null) return { kind: "missing" as const };
      if (currentSlide.version !== input.expectedVersion) {
        return { kind: "conflict" as const, slide: currentSlide };
      }

      const title = input.title.trim();
      const description = input.description.trim();
      const version = currentSlide.version + 1;
      const now = FieldValue.serverTimestamp();
      transaction.update(slideRef, {
        description,
        title,
        updatedAt: now,
        updatedBy: account.uid,
        version,
      });
      transaction.update(workspaceRef, { updatedAt: now });
      transaction.set(activityRef, {
        actorUid: account.uid,
        changedFields: ["title", "description"],
        createdAt: now,
        resourceId: slideId,
        resourceName: title,
        resourceType: "slide",
        type: "slide.updated",
        workspaceId,
      });
      return {
        kind: "updated" as const,
        slide: { id: slideId, title, description, version },
      };
    });
  },
};

const handler = createSlideHandler(productionDependencies);

export default async function slides(request: Request): Promise<Response> {
  try {
    return await handler(request);
  } catch (error) {
    console.error("Slide request failed.", error);
    return jsonResponse({ error: "Slide access is unavailable." }, 503);
  }
}
