import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import type { DeckSummary } from "../../lib/decks/api-response";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import {
  requestDeck,
  requestDeckDuplication,
  requestDeckUpdate,
} from "./deck-client";

type EditorState =
  | { kind: "loading" }
  | { kind: "ready"; deck: DeckSummary }
  | { kind: "error"; message: string };

type DeckEditorPageProps = {
  user: User;
  workspaceId: string;
  deckId: string;
  role: WorkspaceRole;
  onBack: () => void;
  onDuplicated: (deck: DeckSummary) => void;
  onUpdated: (deck: DeckSummary) => void;
  onOpenSlideLibrary: () => void;
};

export default function DeckEditorPage({
  user,
  workspaceId,
  deckId,
  role,
  onBack,
  onDuplicated,
  onUpdated,
  onOpenSlideLibrary,
}: DeckEditorPageProps) {
  const [state, setState] = useState<EditorState>({ kind: "loading" });
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("15");
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [conflictDeck, setConflictDeck] = useState<DeckSummary | null>(null);
  const canEdit = role !== "viewer";

  useEffect(() => {
    let current = true;
    void requestDeck(user, workspaceId, deckId).then(
      (deck) => {
        if (!current) return;
        setState({ kind: "ready", deck });
        setName(deck.name);
        setDuration(String(deck.defaultDisplayDurationSeconds));
      },
      (error: unknown) => {
        if (!current) return;
        setState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "QRousel could not load this deck.",
        });
      },
    );
    return () => {
      current = false;
    };
  }, [deckId, user, workspaceId]);

  const parsedDuration = Number(duration);
  const isValid =
    name.trim().length > 0 &&
    Number.isSafeInteger(parsedDuration) &&
    parsedDuration > 0;
  const isDirty = useMemo(
    () =>
      state.kind === "ready" &&
      (name.trim() !== state.deck.name ||
        parsedDuration !== state.deck.defaultDisplayDurationSeconds),
    [name, parsedDuration, state],
  );

  function applyDeck(deck: DeckSummary) {
    setState({ kind: "ready", deck });
    setName(deck.name);
    setDuration(String(deck.defaultDisplayDurationSeconds));
    setConflictDeck(null);
    setSaveError("");
    onUpdated(deck);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !isValid || !isDirty || state.kind !== "ready") return;
    setIsSaving(true);
    setSaveError("");
    setConflictDeck(null);
    try {
      const result = await requestDeckUpdate(user, workspaceId, deckId, {
        name,
        defaultDisplayDurationSeconds: parsedDuration,
        expectedVersion: state.deck.version,
      });
      if (result.kind === "conflict") {
        setConflictDeck(result.deck);
        return;
      }
      applyDeck(result.deck);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "QRousel could not save this deck.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function duplicateDeck(
    copyName: string,
    copyDuration: number,
  ): Promise<void> {
    if (!canEdit || isDuplicating || state.kind !== "ready") return;
    setIsDuplicating(true);
    setSaveError("");
    try {
      const result = await requestDeckDuplication(
        user,
        workspaceId,
        deckId,
        {
          name: copyName,
          defaultDisplayDurationSeconds: copyDuration,
        },
      );
      if (result.kind === "limit") {
        setSaveError(
          `This workspace can contain up to ${result.limit} decks.`,
        );
        return;
      }
      setConflictDeck(null);
      onDuplicated(result.deck);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "QRousel could not duplicate this deck.",
      );
    } finally {
      setIsDuplicating(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <section className="deck-editor-status" aria-label="Loading deck">
        <span className="auth-spinner" aria-hidden="true" />
        <p>Loading deck…</p>
      </section>
    );
  }

  if (state.kind === "error") {
    return (
      <section className="deck-editor-status">
        <h1>We could not open this deck</h1>
        <p>{state.message}</p>
        <button type="button" onClick={onBack}>
          Back to decks
        </button>
      </section>
    );
  }

  return (
    <>
      <button className="deck-editor-back" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Decks
      </button>
      <header className="deck-editor-heading">
        <div>
          <span className="deck-status">{state.deck.publicationStatus}</span>
          <h1>{state.deck.name}</h1>
          <p>
            {state.deck.slideCount} {state.deck.slideCount === 1 ? "slide" : "slides"}
            <span aria-hidden="true"> · </span>Version {state.deck.version}
          </p>
        </div>
        <div className="deck-editor-heading-actions">
          {canEdit && (
            <button
              type="button"
              disabled={isDuplicating || isSaving}
              onClick={() =>
                void duplicateDeck(
                  `${state.deck.name} copy`,
                  state.deck.defaultDisplayDurationSeconds,
                )
              }
            >
              {isDuplicating ? "Duplicating…" : "Duplicate deck"}
            </button>
          )}
          {!canEdit && <span className="deck-editor-readonly">Read only</span>}
        </div>
      </header>

      {conflictDeck && (
        <section className="deck-conflict" role="alert">
          <p className="workspace-kicker">Changed elsewhere</p>
          <h2>This deck was updated after you opened it</h2>
          <p>Compare your unsaved settings with the latest saved version.</p>
          <div className="deck-conflict-grid">
            <div>
              <span>Your changes</span>
              <strong>{name.trim()}</strong>
              <small>{duration}s default timing</small>
            </div>
            <div>
              <span>Latest version</span>
              <strong>{conflictDeck.name}</strong>
              <small>
                {conflictDeck.defaultDisplayDurationSeconds}s default timing
              </small>
            </div>
          </div>
          <div className="deck-conflict-actions">
            <button
              type="button"
              disabled={!isValid || isDuplicating}
              onClick={() => void duplicateDeck(name, parsedDuration)}
            >
              {isDuplicating ? "Saving copy…" : "Save as copy"}
            </button>
            <button type="button" onClick={() => applyDeck(conflictDeck)}>
              Reload latest
            </button>
            <button type="button" onClick={onBack}>
              Cancel
            </button>
          </div>
        </section>
      )}

      <div className="deck-editor-grid">
        <section className="deck-editor-content">
          <div>
            <p className="workspace-kicker">Deck content</p>
            <h2>Slides</h2>
          </div>
          <div className="deck-editor-empty">
            <span aria-hidden="true">0</span>
            <h3>No slides in this deck</h3>
            <p>Add reusable slides to start building the presentation.</p>
            {canEdit && <button className="deck-slide-add-tile" type="button" onClick={onOpenSlideLibrary}><strong aria-hidden="true">+</strong><span>Choose or create a slide</span></button>}
          </div>
        </section>

        <form className="deck-settings-card" onSubmit={save}>
          <div>
            <p className="workspace-kicker">Deck settings</p>
            <h2>Presentation defaults</h2>
          </div>
          <label>
            <span>Deck name</span>
            <input
              value={name}
              disabled={!canEdit}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            <span>Default slide duration</span>
            <div className="deck-duration-input">
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={duration}
                disabled={!canEdit}
                onChange={(event) => setDuration(event.target.value)}
              />
              <span>seconds</span>
            </div>
            <small>Used by every slide without its own timing override.</small>
          </label>
          {saveError && (
            <p className="auth-error" role="alert">
              {saveError}
            </p>
          )}
          {canEdit && (
            <div className="deck-settings-actions">
              <button type="button" onClick={onBack}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || !isDirty || isSaving}
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </form>
      </div>
    </>
  );
}
