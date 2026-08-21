import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import type { DeckSummary } from "../../lib/decks/api-response";
import { requestDeckCreation, requestDecks } from "./deck-client";

type DeckLibraryState =
  | { kind: "loading"; workspaceId: string }
  | { kind: "ready"; workspaceId: string; decks: DeckSummary[] }
  | { kind: "error"; workspaceId: string; message: string };

export function useDeckLibrary(user: User, workspaceId: string) {
  const [state, setState] = useState<DeckLibraryState>({
    kind: "loading",
    workspaceId,
  });
  const [reloadVersion, setReloadVersion] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState("");

  useEffect(() => {
    let current = true;
    void requestDecks(user, workspaceId).then(
      (decks) => {
        if (current) setState({ kind: "ready", workspaceId, decks });
      },
      (error: unknown) => {
        if (!current) return;
        setState({
          kind: "error",
          workspaceId,
          message:
            error instanceof Error
              ? error.message
              : "QRousel could not load your decks.",
        });
      },
    );
    return () => {
      current = false;
    };
  }, [reloadVersion, user, workspaceId]);

  const currentState: DeckLibraryState =
    state.workspaceId === workspaceId
      ? state
      : { kind: "loading", workspaceId };

  async function create(name: string): Promise<boolean> {
    if (isCreating) return false;
    const existingDecks =
      currentState.kind === "ready" ? currentState.decks : [];
    setIsCreating(true);
    setCreationError("");
    try {
      const result = await requestDeckCreation(user, workspaceId, name);
      if (result.kind === "limit") {
        setCreationError(`This workspace can contain up to ${result.limit} decks.`);
        return false;
      }
      setState({
        kind: "ready",
        workspaceId,
        decks: [result.deck, ...existingDecks],
      });
      return true;
    } catch (error) {
      setCreationError(
        error instanceof Error
          ? error.message
          : "QRousel could not create this deck.",
      );
      return false;
    } finally {
      setIsCreating(false);
    }
  }

  function acceptUpdatedDeck(deck: DeckSummary) {
    setState((current) => {
      if (current.kind !== "ready" || current.workspaceId !== workspaceId) {
        return { kind: "ready", workspaceId, decks: [deck] };
      }
      return {
        ...current,
        decks: current.decks.map((item) =>
          item.id === deck.id ? deck : item,
        ),
      };
    });
  }

  return {
    state: currentState,
    decks: currentState.kind === "ready" ? currentState.decks : [],
    isCreating,
    creationError,
    clearCreationError: () => setCreationError(""),
    create,
    acceptUpdatedDeck,
    retry: async () => {
      setState({ kind: "loading", workspaceId });
      setReloadVersion((version) => version + 1);
    },
  };
}
