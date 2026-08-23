import { useState, type FormEvent } from "react";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import type { useDeckLibrary } from "./use-deck-library";

export default function DeckCreatePage({ library, role, onBack, onCreated }: { library: ReturnType<typeof useDeckLibrary>; role: WorkspaceRole; onBack: () => void; onCreated: (deckId: string) => void }) {
  const [name, setName] = useState("");
  const canEdit = role !== "viewer";
  async function submit(event: FormEvent) { event.preventDefault(); if (!canEdit) return; const deck = await library.create(name); if (deck) onCreated(deck.id); }
  return <><button className="deck-editor-back" type="button" onClick={onBack}><span>←</span> Decks</button><header className="deck-editor-heading"><div><span className="deck-status">new presentation</span><h1>Create a deck</h1><p>Set the presentation name, then add reusable slides from the deck editor.</p></div></header><form className="deck-settings-card deck-create-page" onSubmit={submit}><label><span>Deck name</span><input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Autumn campaign" /></label><p>New decks start as drafts with a 15-second default slide interval.</p>{library.creationError && <p className="auth-error">{library.creationError}</p>}<div className="deck-settings-actions"><button type="button" onClick={onBack}>Cancel</button><button type="submit" disabled={!canEdit || !name.trim() || library.isCreating}>{library.isCreating ? "Creating…" : "Create deck"}</button></div></form></>;
}
