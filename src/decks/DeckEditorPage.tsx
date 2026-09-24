import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import type { DeckSummary } from "../../lib/decks/api-response";
import type { DeckSlide } from "../../lib/decks/slide-assignment";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import {
  requestDeck,
  requestDeckDuplication,
  requestDeckUpdate,
  addDeckSlide,
  requestDeckSlides,
  updateDeckSlideTiming,
  reorderDeckSlides,
  removeDeckSlide,
} from "./deck-client";
import { requestSlides } from "../slides/slide-client";
import type { SlideSummary } from "../../lib/slides/api-response";

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
  const [isPublishing, setIsPublishing] = useState(false);
  const [presentationPasscode, setPresentationPasscode] = useState("");
  const [publicationError, setPublicationError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [conflictDeck, setConflictDeck] = useState<DeckSummary | null>(null);
  const [deckSlides, setDeckSlides] = useState<DeckSlide[]>([]);
  const [availableSlides, setAvailableSlides] = useState<SlideSummary[]>([]);
  const [selectedSlideId, setSelectedSlideId] = useState("");
  const [slideError, setSlideError] = useState("");
  const [isUpdatingSlides, setIsUpdatingSlides] = useState(false);
  const [draggedSlideId, setDraggedSlideId] = useState<string | null>(null);
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

  useEffect(() => {
    let current = true;
    void Promise.all([requestDeckSlides(user, workspaceId, deckId), requestSlides(user, workspaceId)]).then(([assigned, available]) => { if (current) { setDeckSlides(assigned); setAvailableSlides(available); } }, () => { if (current) setSlideError("QRousel could not load slides for this deck."); });
    return () => { current = false; };
  }, [deckId, user, workspaceId]);

  async function addSelectedSlide() {
    if (!selectedSlideId || isUpdatingSlides) return;
    setIsUpdatingSlides(true); setSlideError("");
    try { const assigned = await addDeckSlide(user, workspaceId, deckId, selectedSlideId); setDeckSlides((items) => [...items, assigned]); if (state.kind === "ready") applyDeck({ ...state.deck, slideCount: state.deck.slideCount + 1, version: state.deck.version + 1 }); setSelectedSlideId(""); }
    catch (error) { setSlideError(error instanceof Error ? error.message : "QRousel could not add this slide."); }
    finally { setIsUpdatingSlides(false); }
  }

  async function saveTiming(assignment: DeckSlide, value: string) {
    const duration = value === "" ? null : Number(value);
    if (duration !== null && (!Number.isSafeInteger(duration) || duration < 1)) return;
    setIsUpdatingSlides(true); setSlideError("");
    try { await updateDeckSlideTiming(user, workspaceId, deckId, assignment.id, duration); setDeckSlides((items) => items.map((item) => item.id === assignment.id ? { ...item, displayDurationSeconds: duration } : item)); }
    catch (error) { setSlideError(error instanceof Error ? error.message : "QRousel could not save this timing."); }
    finally { setIsUpdatingSlides(false); }
  }

  async function moveSlide(draggedId: string, targetId: string) {
    if (draggedId === targetId || isUpdatingSlides) return;
    const from = deckSlides.findIndex((slide) => slide.id === draggedId), to = deckSlides.findIndex((slide) => slide.id === targetId);
    if (from < 0 || to < 0) return;
    const reordered = [...deckSlides];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setIsUpdatingSlides(true); setSlideError("");
    try { await reorderDeckSlides(user, workspaceId, deckId, reordered.map((slide) => slide.id)); setDeckSlides(reordered.map((slide, position) => ({ ...slide, position }))); if (state.kind === "ready") applyDeck({ ...state.deck, version: state.deck.version + 1 }); }
    catch (error) { setSlideError(error instanceof Error ? error.message : "QRousel could not reorder this deck."); }
    finally { setIsUpdatingSlides(false); setDraggedSlideId(null); }
  }

  async function removeSlide(assignment: DeckSlide) {
    if (isUpdatingSlides || !window.confirm(`Remove “${assignment.title}” from this deck? The reusable slide stays in your library.`)) return;
    setIsUpdatingSlides(true); setSlideError("");
    try { await removeDeckSlide(user, workspaceId, deckId, assignment.id); setDeckSlides((slides) => slides.filter((slide) => slide.id !== assignment.id).map((slide, position) => ({ ...slide, position }))); if (state.kind === "ready") applyDeck({ ...state.deck, slideCount: state.deck.slideCount - 1, version: state.deck.version + 1 }); }
    catch (error) { setSlideError(error instanceof Error ? error.message : "QRousel could not remove this slide."); }
    finally { setIsUpdatingSlides(false); }
  }

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
  async function togglePublication() {
    if (state.kind !== "ready") return;
    setIsPublishing(true);
    setPublicationError("");
    try {
      const next = state.deck.publicationStatus === "published" ? "draft" : "published";
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/decks/${encodeURIComponent(deckId)}/publication`, { method: "POST", headers: { authorization: `Bearer ${await user.getIdToken()}`, "content-type": "application/json" }, body: JSON.stringify({ publicationStatus: next, ...(next === "published" ? { passcode: presentationPasscode } : {}) }) });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "QRousel could not update this presentation.");
      applyDeck({ ...state.deck, publicationStatus: next, version: state.deck.version + 1 });
      setPresentationPasscode("");
    } catch (error) { setPublicationError(error instanceof Error ? error.message : "QRousel could not update this presentation."); }
    finally { setIsPublishing(false); }
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
            <button type="button" disabled={isPublishing || state.deck.slideCount === 0} onClick={() => void togglePublication()}>{state.deck.publicationStatus === "published" ? "Unpublish" : "Publish deck"}</button>
          )}
          {state.deck.publicationStatus === "published" && <a href={`/present/${encodeURIComponent(deckId)}`} target="_blank" rel="noreferrer">Open presentation</a>}
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
          {deckSlides.length === 0 ? <div className="deck-editor-empty"><span aria-hidden="true">0</span><h3>No slides in this deck</h3><p>Add reusable slides to start building the presentation.</p></div> : <div className="deck-slide-grid">{deckSlides.map((slide) => <article className="deck-slide-tile" key={slide.id} draggable={canEdit && !isUpdatingSlides} onDragStart={() => setDraggedSlideId(slide.id)} onDragOver={(event) => { if (canEdit) event.preventDefault(); }} onDrop={() => { if (draggedSlideId) void moveSlide(draggedSlideId, slide.id); }}><span className="deck-status">slide {slide.position + 1}</span><h3>{slide.title}</h3><p>{slide.description || "No description"}</p><small>{slide.qrCodeName ? `QR: ${slide.qrCodeName}` : "No QR code selected"}</small><label>Timing override<input type="number" min="1" value={slide.displayDurationSeconds ?? ""} placeholder={`${state.deck.defaultDisplayDurationSeconds}s default`} onChange={(event) => void saveTiming(slide, event.target.value)} disabled={!canEdit || isUpdatingSlides} /></label>{canEdit && <div className="deck-slide-actions"><button type="button" className="workspace-text-button" disabled={isUpdatingSlides} onClick={() => void removeSlide(slide)}>Remove</button><small>Drag to reorder</small></div>}</article>)}</div>}
          {canEdit && <div className="deck-slide-picker"><div><strong>Add a reusable slide</strong><span>Choose one already in this workspace, or create a new one.</span></div><select value={selectedSlideId} onChange={(event) => setSelectedSlideId(event.target.value)}><option value="">Choose a slide</option>{availableSlides.map((slide) => <option key={slide.id} value={slide.id}>{slide.title}</option>)}</select><button type="button" disabled={!selectedSlideId || isUpdatingSlides} onClick={() => void addSelectedSlide()}>Add slide</button><button className="workspace-text-button" type="button" onClick={onOpenSlideLibrary}>Open slides library</button></div>}
          {slideError && <p className="auth-error">{slideError}</p>}
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
          <label>
            <span>Presentation passcode</span>
            <input type="password" minLength={4} maxLength={64} value={presentationPasscode} disabled={!canEdit || state.deck.publicationStatus === "published"} onChange={(event) => setPresentationPasscode(event.target.value)} placeholder="Optional — set before publishing" />
            <small>{state.deck.publicationStatus === "published" ? "Unpublish, set a new passcode, then publish again to change access." : "Leave blank for a public presentation. Passcodes must be 4–64 characters."}</small>
          </label>
          {publicationError && <p className="auth-error" role="alert">{publicationError}</p>}
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
