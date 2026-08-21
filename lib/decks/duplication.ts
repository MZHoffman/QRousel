import { DECK_LIMIT } from "./creation.ts";

type DeckDuplicationInput = {
  deckCount: number;
  sourceName: string;
  sourceDefaultDisplayDurationSeconds: number;
  requestedName?: string;
  requestedDefaultDisplayDurationSeconds?: number;
};

export type DeckDuplicationDecision =
  | {
      kind: "duplicate";
      name: string;
      defaultDisplayDurationSeconds: number;
      nextDeckCount: number;
      publicationStatus: "draft";
      slideCount: 0;
      version: 1;
    }
  | { kind: "limit"; limit: number };

export function decideDeckDuplication({
  deckCount,
  sourceName,
  sourceDefaultDisplayDurationSeconds,
  requestedName,
  requestedDefaultDisplayDurationSeconds,
}: DeckDuplicationInput): DeckDuplicationDecision {
  if (!Number.isSafeInteger(deckCount) || deckCount < 0) {
    throw new Error("The deck resource counter is invalid.");
  }

  if (deckCount >= DECK_LIMIT) {
    return { kind: "limit", limit: DECK_LIMIT };
  }

  const name = (requestedName ?? `${sourceName} copy`).trim();
  if (name.length === 0) {
    throw new Error("A deck name is required.");
  }

  const defaultDisplayDurationSeconds =
    requestedDefaultDisplayDurationSeconds ??
    sourceDefaultDisplayDurationSeconds;
  if (
    !Number.isSafeInteger(defaultDisplayDurationSeconds) ||
    defaultDisplayDurationSeconds < 1
  ) {
    throw new Error("The deck duration is invalid.");
  }

  return {
    kind: "duplicate",
    name,
    defaultDisplayDurationSeconds,
    nextDeckCount: deckCount + 1,
    publicationStatus: "draft",
    slideCount: 0,
    version: 1,
  };
}
