import type { User } from "firebase/auth";
import {
  isDeckCreationResponse,
  isDeckLimitResponse,
  isDeckListResponse,
  type DeckSummary,
} from "../../lib/decks/api-response";

export type DeckCreationOutcome =
  | { kind: "created"; deck: DeckSummary }
  | { kind: "limit"; limit: number };

function deckEndpoint(workspaceId: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}/decks`;
}

async function authorizationHeaders(user: User): Promise<HeadersInit> {
  return { authorization: `Bearer ${await user.getIdToken()}` };
}

export async function requestDecks(
  user: User,
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
  user: User,
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
