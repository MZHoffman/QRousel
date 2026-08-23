import { useMemo, useState, type FormEvent } from "react";
import { SLIDE_LIMIT } from "../../lib/slides/creation";
import type { SlideSummary } from "../../lib/slides/api-response";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import type { useSlideLibrary } from "./use-slide-library";

type SlideLibraryPageProps = {
  library: ReturnType<typeof useSlideLibrary>;
  role: WorkspaceRole;
  onCreatePage: () => void;
};

type EditorState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; slide: SlideSummary; conflict: boolean };

export default function SlideLibraryPage({
  library,
  role,
  onCreatePage,
}: SlideLibraryPageProps) {
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState>({ kind: "closed" });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const canEdit = role !== "viewer";
  const filteredSlides = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return library.slides;
    return library.slides.filter((slide) =>
      (slide.title + " " + slide.description)
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [library.slides, query]);

  function openEdit(slide: SlideSummary) {
    library.clearSaveError();
    setTitle(slide.title);
    setDescription(slide.description);
    setEditor({ kind: "edit", slide, conflict: false });
  }

  function closeEditor() {
    library.clearSaveError();
    setEditor({ kind: "closed" });
  }

  async function submitSlide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (title.trim().length === 0 || editor.kind === "closed") return;

    if (editor.kind === "create") {
      if (await library.create({ title, description })) closeEditor();
      return;
    }

    const outcome = await library.update(editor.slide, { title, description });
    if (outcome.kind === "updated") {
      closeEditor();
    } else if (outcome.kind === "conflict") {
      setTitle(outcome.slide.title);
      setDescription(outcome.slide.description);
      setEditor({ kind: "edit", slide: outcome.slide, conflict: true });
    }
  }

  const editorTitle =
    editor.kind === "create" ? "Create a slide" : "Edit slide";
  const inputValid = title.trim().length > 0;

  return (
    <>
      <header className="workspace-page-heading deck-library-heading">
        <div>
          <p className="workspace-kicker">Reusable content</p>
          <h1>Slides</h1>
          <p>Create slides once and use them across every deck.</p>
        </div>
        {canEdit && (
          <button type="button" onClick={onCreatePage}>
            New slide <span aria-hidden="true">→</span>
          </button>
        )}
      </header>

      <div className="deck-library-toolbar">
        <label>
          <span className="visually-hidden">Search slides</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search slides"
          />
        </label>
        <span>
          {library.state.kind === "ready" ? library.slides.length : "—"} /{" "}
          {SLIDE_LIMIT} slides
        </span>
      </div>

      {library.state.kind === "loading" && (
        <section className="deck-library-status" aria-label="Loading slides">
          <span className="auth-spinner" aria-hidden="true" />
          <p>Loading slides…</p>
        </section>
      )}

      {library.state.kind === "error" && (
        <section className="deck-library-status">
          <h2>We could not load your slides</h2>
          <p>{library.state.message}</p>
          <button type="button" onClick={library.retry}>
            Try again
          </button>
        </section>
      )}

      {library.state.kind === "ready" && library.slides.length === 0 && (
        <section className="workspace-library-empty">
          <span className="workspace-empty-mark deck-empty-mark" aria-hidden="true">
            0
          </span>
          <h2>No slides yet</h2>
          <p>Create a reusable slide, then add it to any deck later.</p>
          {canEdit && (
            <button className="deck-empty-action" type="button" onClick={onCreatePage}>
              Create your first slide
            </button>
          )}
        </section>
      )}

      {library.state.kind === "ready" && library.slides.length > 0 && (
        <>
          {filteredSlides.length === 0 ? (
            <section className="deck-library-status">
              <h2>No matching slides</h2>
              <p>Try a different search.</p>
            </section>
          ) : (
            <section className="slide-card-grid" aria-label="Reusable slides">
              {filteredSlides.map((slide) => (
                <article className="slide-card" key={slide.id}>
                  <span className="deck-status">reusable slide</span>
                  <h2>{slide.title}</h2>
                  <p>{slide.description || "No description yet."}</p>
                  {canEdit && (
                    <button type="button" onClick={() => openEdit(slide)}>
                      Edit slide
                    </button>
                  )}
                </article>
              ))}
            </section>
          )}
        </>
      )}

      {editor.kind !== "closed" && canEdit && (
        <div className="deck-dialog-backdrop" role="presentation">
          <section
            className="deck-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="slide-editor-title"
          >
            <button
              className="deck-dialog-close"
              type="button"
              aria-label="Close"
              onClick={closeEditor}
            >
              ×
            </button>
            <p className="workspace-kicker">Reusable content</p>
            <h2 id="slide-editor-title">{editorTitle}</h2>
            <p>
              QR codes will be linked from this slide library in the next feature.
            </p>
            {editor.kind === "edit" && editor.conflict && (
              <p className="auth-error" role="alert">
                Another editor saved changes first. The latest version is loaded
                below; review it and save again.
              </p>
            )}
            <form onSubmit={submitSlide}>
              <label>
                <span>Title</span>
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Visitor welcome"
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Tell visitors what this QR code is for."
                />
              </label>
              {library.saveError && (
                <p className="auth-error" role="alert">
                  {library.saveError}
                </p>
              )}
              <div>
                <button type="button" onClick={closeEditor}>
                  Cancel
                </button>
                <button type="submit" disabled={!inputValid || library.isSaving}>
                  {library.isSaving
                    ? "Saving…"
                    : editor.kind === "create"
                      ? "Create slide"
                      : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
