import type { User } from "firebase/auth";
import {
  isDeckCreationResponse,
  isDeckConflictResponse,
  isDeckLimitResponse,
  isDeckListResponse,
  type DeckSummary,
} from "../../lib/decks/api-response.ts";

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
