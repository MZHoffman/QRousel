type DeckUpdateInput = {
  currentVersion: number;
  expectedVersion: number;
  requestedName: string;
  requestedDefaultDisplayDurationSeconds: number;
};

export type DeckUpdateDecision =
  | {
      kind: "update";
      name: string;
      defaultDisplayDurationSeconds: number;
      nextVersion: number;
    }
  | { kind: "conflict"; currentVersion: number };

export function decideDeckUpdate({
  currentVersion,
  expectedVersion,
  requestedName,
  requestedDefaultDisplayDurationSeconds,
}: DeckUpdateInput): DeckUpdateDecision {
  if (
    !Number.isSafeInteger(currentVersion) ||
    currentVersion < 1 ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 1
  ) {
    throw new Error("The deck version is invalid.");
  }

  const name = requestedName.trim();
  if (name.length === 0) {
    throw new Error("A deck name is required.");
  }

  if (
    !Number.isSafeInteger(requestedDefaultDisplayDurationSeconds) ||
    requestedDefaultDisplayDurationSeconds < 1
  ) {
    throw new Error("The default display duration is invalid.");
  }

  if (expectedVersion !== currentVersion) {
    return { kind: "conflict", currentVersion };
  }

  return {
    kind: "update" as const,
    name,
    defaultDisplayDurationSeconds:
      requestedDefaultDisplayDurationSeconds,
    nextVersion: currentVersion + 1,
  };
}
