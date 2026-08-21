export const DECK_PUBLICATION_STATUSES = ["draft", "published"] as const;

export type DeckPublicationStatus =
  (typeof DECK_PUBLICATION_STATUSES)[number];

export type DeckSummary = {
  id: string;
  name: string;
  publicationStatus: DeckPublicationStatus;
  defaultDisplayDurationSeconds: number;
  slideCount: number;
  version: number;
};

export type DeckListResponse = { decks: DeckSummary[] };
export type DeckCreationResponse = { deck: DeckSummary };
export type DeckLimitResponse = { status: "limit_reached"; limit: number };
export type DeckConflictResponse = { status: "conflict"; deck: DeckSummary };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isDeckSummary(value: unknown): value is DeckSummary {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    typeof value.publicationStatus === "string" &&
    DECK_PUBLICATION_STATUSES.includes(
      value.publicationStatus as DeckPublicationStatus,
    ) &&
    Number.isSafeInteger(value.defaultDisplayDurationSeconds) &&
    Number(value.defaultDisplayDurationSeconds) > 0 &&
    isNonNegativeInteger(value.slideCount) &&
    Number.isSafeInteger(value.version) &&
    Number(value.version) > 0
  );
}

export function isDeckListResponse(value: unknown): value is DeckListResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.decks) &&
    value.decks.every(isDeckSummary)
  );
}

export function isDeckCreationResponse(
  value: unknown,
): value is DeckCreationResponse {
  return isRecord(value) && isDeckSummary(value.deck);
}

export function isDeckLimitResponse(value: unknown): value is DeckLimitResponse {
  return (
    isRecord(value) &&
    value.status === "limit_reached" &&
    Number.isSafeInteger(value.limit) &&
    Number(value.limit) > 0
  );
}

export function isDeckConflictResponse(
  value: unknown,
): value is DeckConflictResponse {
  return (
    isRecord(value) &&
    value.status === "conflict" &&
    isDeckSummary(value.deck)
  );
}
