import type { User } from "firebase/auth";
import {
  isDeckCreationResponse,
  isDeckConflictResponse,
  isDeckLimitResponse,
  isDeckListResponse,
  type DeckSummary,
} from "../../lib/decks/api-response.ts";
import { isDeckSlideListResponse, type DeckSlide } from "../../lib/decks/slide-assignment.ts";

type AuthenticatedUser = Pick<User, "getIdToken">;

export type DeckCreationOutcome =
  | { kind: "created"; deck: DeckSummary }
  | { kind: "limit"; limit: number };

export type DeckUpdateOutcome =
  | { kind: "updated"; deck: DeckSummary }
  | { kind: "conflict"; deck: DeckSummary };

export type DeckDuplicationOutcome =
  | { kind: "duplicated"; deck: DeckSummary }
  | { kind: "limit"; limit: number };

function deckEndpoint(workspaceId: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/decks`;
}

function deckDetailEndpoint(workspaceId: string, deckId: string): string {
  return `${deckEndpoint(workspaceId)}/${encodeURIComponent(deckId)}`;
}

function deckDuplicateEndpoint(workspaceId: string, deckId: string): string {
  return `${deckDetailEndpoint(workspaceId, deckId)}/duplicate`;
}

function deckSlidesEndpoint(workspaceId: string, deckId: string): string {
  return `${deckDetailEndpoint(workspaceId, deckId)}/slides`;
}

export async function requestDeckSlides(user: AuthenticatedUser, workspaceId: string, deckId: string): Promise<DeckSlide[]> {
  const response = await fetch(deckSlidesEndpoint(workspaceId, deckId), { headers: await authorizationHeaders(user) });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isDeckSlideListResponse(body)) return body.slides;
  throw new Error("QRousel could not load this deck's slides.");
}

export async function addDeckSlide(user: AuthenticatedUser, workspaceId: string, deckId: string, slideId: string): Promise<DeckSlide> {
  const response = await fetch(deckSlidesEndpoint(workspaceId, deckId), { method: "POST", headers: { ...(await authorizationHeaders(user)), "content-type": "application/json" }, body: JSON.stringify({ slideId }) });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && typeof body === "object" && body !== null && "slide" in body) {
    const candidate = { slides: [body.slide] };
    if (isDeckSlideListResponse(candidate)) return candidate.slides[0];
  }
  throw new Error("QRousel could not add this slide to the deck.");
}

export async function updateDeckSlideTiming(user: AuthenticatedUser, workspaceId: string, deckId: string, assignmentId: string, displayDurationSeconds: number | null): Promise<void> {
  const response = await fetch(`${deckSlidesEndpoint(workspaceId, deckId)}/${encodeURIComponent(assignmentId)}`, { method: "PATCH", headers: { ...(await authorizationHeaders(user)), "content-type": "application/json" }, body: JSON.stringify({ displayDurationSeconds }) });
  if (!response.ok) throw new Error("QRousel could not save this slide timing.");
}

export async function reorderDeckSlides(user: AuthenticatedUser, workspaceId: string, deckId: string, orderedAssignmentIds: string[]): Promise<void> {
  const response = await fetch(deckSlidesEndpoint(workspaceId, deckId), { method: "PATCH", headers: { ...(await authorizationHeaders(user)), "content-type": "application/json" }, body: JSON.stringify({ orderedAssignmentIds }) });
  if (!response.ok) throw new Error("QRousel could not reorder this deck. Reload and try again.");
}

export async function removeDeckSlide(user: AuthenticatedUser, workspaceId: string, deckId: string, assignmentId: string): Promise<void> {
  const response = await fetch(`${deckSlidesEndpoint(workspaceId, deckId)}/${encodeURIComponent(assignmentId)}`, { method: "DELETE", headers: await authorizationHeaders(user) });
  if (!response.ok) throw new Error("QRousel could not remove this slide from the deck.");
}

async function authorizationHeaders(
  user: AuthenticatedUser,
): Promise<HeadersInit> {
  return { authorization: `Bearer ${await user.getIdToken()}` };
}

export async function requestDecks(
  user: AuthenticatedUser,
  workspaceId: string,
): Promise<DeckSummary[]> {
  const response = await fetch(deckEndpoint(workspaceId), {
    headers: await authorizationHeaders(user),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isDeckListResponse(body)) return body.decks;
  throw new Error("QRousel could not load your decks.");
}

export async function requestDeckCreation(
  user: AuthenticatedUser,
  workspaceId: string,
  name: string,
): Promise<DeckCreationOutcome> {
  const response = await fetch(deckEndpoint(workspaceId), {
    method: "POST",
    headers: {
      ...(await authorizationHeaders(user)),
      "content-type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isDeckCreationResponse(body)) {
    return { kind: "created", deck: body.deck };
  }
  if (response.status === 409 && isDeckLimitResponse(body)) {
    return { kind: "limit", limit: body.limit };
  }
  throw new Error("QRousel could not create this deck.");
}

export async function requestDeck(
  user: AuthenticatedUser,
  workspaceId: string,
  deckId: string,
): Promise<DeckSummary> {
  const response = await fetch(deckDetailEndpoint(workspaceId, deckId), {
    headers: await authorizationHeaders(user),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isDeckCreationResponse(body)) return body.deck;
  throw new Error("QRousel could not load this deck.");
}

export async function requestDeckUpdate(
  user: AuthenticatedUser,
  workspaceId: string,
  deckId: string,
  input: {
    name: string;
    defaultDisplayDurationSeconds: number;
    expectedVersion: number;
  },
): Promise<DeckUpdateOutcome> {
  const response = await fetch(deckDetailEndpoint(workspaceId, deckId), {
    method: "PATCH",
    headers: {
      ...(await authorizationHeaders(user)),
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isDeckCreationResponse(body)) {
    return { kind: "updated", deck: body.deck };
  }
  if (response.status === 409 && isDeckConflictResponse(body)) {
    return { kind: "conflict", deck: body.deck };
  }
  throw new Error("QRousel could not save this deck.");
}

export async function requestDeckDuplication(
  user: AuthenticatedUser,
  workspaceId: string,
  sourceDeckId: string,
  input: {
    name: string;
    defaultDisplayDurationSeconds: number;
  },
): Promise<DeckDuplicationOutcome> {
  const response = await fetch(
    deckDuplicateEndpoint(workspaceId, sourceDeckId),
    {
      method: "POST",
      headers: {
        ...(await authorizationHeaders(user)),
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isDeckCreationResponse(body)) {
    return { kind: "duplicated", deck: body.deck };
  }
  if (response.status === 409 && isDeckLimitResponse(body)) {
    return { kind: "limit", limit: body.limit };
  }
  throw new Error("QRousel could not duplicate this deck.");
}
