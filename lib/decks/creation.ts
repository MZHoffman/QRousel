export const DEFAULT_DECK_DURATION_SECONDS = 15;
export const DECK_LIMIT = 100;

export type DeckCreationDecision =
  | {
      kind: "create";
      name: string;
      nextDeckCount: number;
      defaultDisplayDurationSeconds: number;
    }
  | { kind: "limit"; limit: number };

type DeckCreationInput = {
  deckCount: number;
  requestedName: string;
};

export function decideDeckCreation({
  deckCount,
  requestedName,
}: DeckCreationInput): DeckCreationDecision {
  if (!Number.isSafeInteger(deckCount) || deckCount < 0) {
    throw new Error("The deck resource counter is invalid.");
  }

  const name = requestedName.trim();
  if (name.length === 0) {
    throw new Error("A deck name is required.");
  }

  if (deckCount >= DECK_LIMIT) {
    return { kind: "limit", limit: DECK_LIMIT };
  }

  return {
    kind: "create" as const,
    name,
    nextDeckCount: deckCount + 1,
    defaultDisplayDurationSeconds: DEFAULT_DECK_DURATION_SECONDS,
  };
}
