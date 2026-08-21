import { useMemo, useState, type FormEvent } from "react";
import { DECK_LIMIT } from "../../lib/decks/creation";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import type { useDeckLibrary } from "./use-deck-library";

type DeckLibraryPageProps = {
  library: ReturnType<typeof useDeckLibrary>;
  role: WorkspaceRole;
  creationOpen: boolean;
  onCreationOpen: () => void;
  onCreationClose: () => void;
  onOpenDeck: (deckId: string) => void;
};

export default function DeckLibraryPage({
  library,
  role,
  creationOpen,
  onCreationOpen,
  onCreationClose,
  onOpenDeck,
}: DeckLibraryPageProps) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const canEdit = role !== "viewer";
  const filteredDecks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return library.decks;
    return library.decks.filter((deck) =>
      deck.name.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [library.decks, query]);

  async function submitDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length === 0) return;
    if (await library.create(name)) {
      setName("");
      onCreationClose();
    }
  }

  return (
    <>
      <header className="workspace-page-heading deck-library-heading">
        <div>
          <p className="workspace-kicker">Presentations</p>
          <h1>Decks</h1>
          <p>Build, publish, and present collections of reusable slides.</p>
        </div>
        {canEdit && (
          <button type="button" onClick={onCreationOpen}>
            New deck <span aria-hidden="true">→</span>
          </button>
        )}
      </header>

      <div className="deck-library-toolbar">
        <label>
          <span className="visually-hidden">Search decks</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search decks"
          />
        </label>
        <span>
          {library.state.kind === "ready" ? library.decks.length : "—"} /{" "}
          {DECK_LIMIT} decks
        </span>
      </div>

      {library.state.kind === "loading" && (
        <section className="deck-library-status" aria-label="Loading decks">
          <span className="auth-spinner" aria-hidden="true" />
          <p>Loading decks…</p>
        </section>
      )}

      {library.state.kind === "error" && (
        <section className="deck-library-status">
          <h2>We could not load your decks</h2>
          <p>{library.state.message}</p>
          <button type="button" onClick={() => void library.retry()}>
            Try again
          </button>
        </section>
      )}

      {library.state.kind === "ready" && library.decks.length === 0 && (
        <section className="workspace-library-empty">
          <span className="workspace-empty-mark deck-empty-mark" aria-hidden="true">
            0
          </span>
          <h2>No decks yet</h2>
          <p>Create a deck to start assembling your presentation.</p>
          {canEdit && (
            <button className="deck-empty-action" type="button" onClick={onCreationOpen}>
              Create your first deck
            </button>
          )}
        </section>
      )}

      {library.state.kind === "ready" && library.decks.length > 0 && (
        <>
          {filteredDecks.length === 0 ? (
            <section className="deck-library-status">
              <h2>No matching decks</h2>
              <p>Try a different search.</p>
            </section>
          ) : (
            <section className="deck-card-grid" aria-label="Decks">
              {filteredDecks.map((deck) => (
                <button
                  className="deck-card"
                  key={deck.id}
                  type="button"
                  onClick={() => onOpenDeck(deck.id)}
                >
                  <div className="deck-card-preview" aria-hidden="true">
                    <span>{deck.slideCount}</span>
                    <small>{deck.slideCount === 1 ? "slide" : "slides"}</small>
                  </div>
                  <div className="deck-card-copy">
                    <span className="deck-status">{deck.publicationStatus}</span>
                    <h2>{deck.name}</h2>
                    <p>
                      {deck.defaultDisplayDurationSeconds}s default timing
                    </p>
                  </div>
                </button>
              ))}
            </section>
          )}
        </>
      )}

      {creationOpen && canEdit && (
        <div className="deck-dialog-backdrop" role="presentation">
          <section
            className="deck-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-deck-title"
          >
            <button
              className="deck-dialog-close"
              type="button"
              aria-label="Close"
              onClick={() => {
                library.clearCreationError();
                onCreationClose();
              }}
            >
              ×
            </button>
            <p className="workspace-kicker">New presentation</p>
            <h2 id="new-deck-title">Create a deck</h2>
            <p>
              New decks start as drafts with a 15-second default slide timing.
            </p>
            <form onSubmit={submitDeck}>
              <label>
                <span>Deck name</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Autumn campaign"
                />
              </label>
              {library.creationError && (
                <p className="auth-error" role="alert">
                  {library.creationError}
                </p>
              )}
              <div>
                <button type="button" onClick={onCreationClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={name.trim().length === 0 || library.isCreating}
                >
                  {library.isCreating ? "Creating…" : "Create deck"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
