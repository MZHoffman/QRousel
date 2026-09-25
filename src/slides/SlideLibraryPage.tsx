import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import type { DeckSummary } from "../../lib/decks/api-response";
import { SLIDE_LIMIT } from "../../lib/slides/creation";
import type { SlideSummary } from "../../lib/slides/api-response";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import { addDeckSlide, requestDecks } from "../decks/deck-client";
import { archiveResource } from "../workspaces/trash-client";
import type { useSlideLibrary } from "./use-slide-library";

type Props = { library: ReturnType<typeof useSlideLibrary>; role: WorkspaceRole; onCreatePage: () => void; onEditPage: (slideId: string) => void; onOpenDeck: (deckId: string) => void; user: User; workspaceId: string };

function PencilIcon() { return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 14.8 1.1-3.3L13.5 3a1.8 1.8 0 0 1 2.5 2.5l-8.5 8.4L4 14.8Z" /><path d="m12 4.5 3.5 3.5" /></svg>; }
function TrashIcon() { return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 6.2h11M8 3.8h4M6.3 6.2l.7 10h6l.7-10M8.7 9v4.4M11.3 9v4.4" /></svg>; }
function PlusIcon() { return <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>; }

function SlideThumbnail({ slide }: { slide: SlideSummary }) {
  const description = slide.description.trim();
  const repeatsTitle = description.toLocaleLowerCase() === slide.title.trim().toLocaleLowerCase();
  return <div className="slide-thumbnail" aria-hidden="true"><div><span>{slide.title}</span>{!repeatsTitle && description && <small>{description}</small>}</div>{slide.qrCodeId && <span className="slide-thumbnail-qr">QR</span>}</div>;
}

export default function SlideLibraryPage({ library, role, onCreatePage, onEditPage, onOpenDeck, user, workspaceId }: Props) {
  const [query, setQuery] = useState("");
  const [decks, setDecks] = useState<DeckSummary[]>([]);
  const [deckPickerFor, setDeckPickerFor] = useState<string | null>(null);
  const [addingToDeck, setAddingToDeck] = useState("");
  const [actionError, setActionError] = useState("");
  const canEdit = role !== "viewer";
  const slides = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? library.slides.filter((slide) => `${slide.title} ${slide.description}`.toLowerCase().includes(term)) : library.slides;
  }, [library.slides, query]);

  useEffect(() => {
    let active = true;
    void requestDecks(user, workspaceId).then((items) => { if (active) setDecks(items); }, () => { if (active) setActionError("QRousel could not load the deck list."); });
    return () => { active = false; };
  }, [user, workspaceId]);

  async function addToDeck(slide: SlideSummary, deckId: string) {
    if (addingToDeck) return;
    setAddingToDeck(deckId);
    setActionError("");
    try {
      await addDeckSlide(user, workspaceId, deckId, slide.id);
      onOpenDeck(deckId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "QRousel could not add this slide to the deck.");
    } finally {
      setAddingToDeck("");
    }
  }

  return <>
    <header className="workspace-page-heading deck-library-heading"><div><p className="workspace-kicker">Reusable content</p><h1>Slides</h1><p>Create slides once and use them across every deck.</p></div></header>
    <div className="deck-library-toolbar"><label><span className="visually-hidden">Search slides</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search slides" /></label><span>{library.state.kind === "ready" ? library.slides.length : "—"} / {SLIDE_LIMIT} slides</span></div>
    {library.state.kind === "loading" && <section className="deck-library-status"><span className="auth-spinner" aria-hidden="true" /><p>Loading slides…</p></section>}
    {library.state.kind === "error" && <section className="deck-library-status"><h2>We could not load your slides</h2><p>{library.state.message}</p><button type="button" onClick={library.retry}>Try again</button></section>}
    {library.state.kind === "ready" && library.slides.length === 0 && <section className="workspace-library-empty"><span className="workspace-empty-mark deck-empty-mark" aria-hidden="true">0</span><h2>No slides yet</h2><p>Create a reusable slide, then add it to any deck later.</p>{canEdit && <button className="deck-empty-action" type="button" onClick={onCreatePage}>Create your first slide</button>}</section>}
    {library.state.kind === "ready" && library.slides.length > 0 && (slides.length === 0 ? <section className="deck-library-status"><h2>No matching slides</h2><p>Try a different search.</p></section> : <section className="slide-card-grid slide-library-grid" aria-label="Reusable slides">
      {slides.map((slide) => <article className="slide-card slide-library-card" key={slide.id}>
        <SlideThumbnail slide={slide} />
        {canEdit && <div className="slide-thumbnail-actions"><button type="button" aria-label={`Edit ${slide.title}`} title="Edit slide" onClick={() => onEditPage(slide.id)}><PencilIcon /></button><button className="slide-thumbnail-trash" type="button" aria-label={`Move ${slide.title} to trash`} title="Move to trash" onClick={() => { if (window.confirm(`Move “${slide.title}” to Trash? You can restore it from Trash for 90 days.`)) void archiveResource(user, workspaceId, "slides", slide.id).then(() => library.retry()); }}><TrashIcon /></button></div>}
        <div className="slide-library-card-copy"><h2>{slide.title}</h2><p>{slide.qrCodeName ? `QR: ${slide.qrCodeName}` : "No QR code"}</p></div>
        {canEdit && <><button className="slide-use-button" type="button" onClick={() => setDeckPickerFor((current) => current === slide.id ? null : slide.id)}><PlusIcon /> Use in deck</button>{deckPickerFor === slide.id && <div className="slide-deck-picker"><strong>Add to a deck</strong>{decks.length === 0 ? <p>Create a deck first, then return here to add this slide.</p> : <div>{decks.map((deck) => <button key={deck.id} type="button" disabled={addingToDeck === deck.id} onClick={() => void addToDeck(slide, deck.id)}><span>{deck.name}</span><small>{deck.slideCount} slides</small></button>)}</div>}</div>}</>}
      </article>)}
      {canEdit && <button className="slide-library-add" type="button" onClick={onCreatePage}><span><PlusIcon /></span><strong>Add slide</strong><small>Create a reusable slide</small></button>}
    </section>)}
    {actionError && <p className="auth-error" role="alert">{actionError}</p>}
  </>;
}
