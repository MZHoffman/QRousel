import { useState, type FormEvent } from "react";
import type { SlideSummary } from "../../lib/slides/api-response";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import type { useSlideLibrary } from "./use-slide-library";

export default function SlideEditPage({ library, role, slide, onBack }: { library: ReturnType<typeof useSlideLibrary>; role: WorkspaceRole; slide: SlideSummary; onBack: () => void }) {
  const [title, setTitle] = useState(slide.title);
  const [description, setDescription] = useState(slide.description);
  const [conflict, setConflict] = useState<SlideSummary | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await library.update(slide, { title, description });
    if (result.kind === "updated") onBack();
    if (result.kind === "conflict") setConflict(result.slide);
  }
  return <><button className="deck-editor-back" type="button" onClick={onBack}><span>←</span> Slides</button><header className="deck-editor-heading"><div><span className="deck-status">reusable slide</span><h1>Edit slide</h1><p>Update its content here. This slide can be reused by multiple decks.</p></div></header>{conflict && <section className="deck-conflict" role="alert"><p className="workspace-kicker">Changed elsewhere</p><h2>This slide was updated after you opened it</h2><p>Reload the latest copy before saving again.</p><div className="deck-conflict-actions"><button type="button" onClick={() => { setTitle(conflict.title); setDescription(conflict.description); setConflict(null); }}>Reload latest</button><button type="button" onClick={onBack}>Cancel</button></div></section>}<form className="deck-settings-card deck-create-page" onSubmit={submit}><label><span>Title</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label><label><span>Description</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label><label><span>QR code</span><button className="resource-field-button" type="button" disabled>Choose a QR code — next step</button></label>{library.saveError && <p className="auth-error">{library.saveError}</p>}<div className="deck-settings-actions"><button type="button" onClick={onBack}>Cancel</button><button disabled={role === "viewer" || !title.trim() || library.isSaving}>{library.isSaving ? "Saving…" : "Save slide"}</button></div></form></>;
}
