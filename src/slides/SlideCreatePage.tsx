import { useState, type FormEvent } from "react";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import type { useSlideLibrary } from "./use-slide-library";
import type { QrCodeSummary } from "../../lib/qr-codes/api-response";

export default function SlideCreatePage({ library, role, qrCodes, onBack }: { library: ReturnType<typeof useSlideLibrary>; role: WorkspaceRole; qrCodes: QrCodeSummary[]; onBack: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [qrCodeId, setQrCodeId] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (await library.create({ title, description, qrCodeId: qrCodeId || null })) onBack(); }
  return <><button className="deck-editor-back" onClick={onBack}><span>←</span> Slides</button><header className="deck-editor-heading"><div><span className="deck-status">new reusable slide</span><h1>Create a slide</h1><p>Add the title, description, and reusable QR code for this slide.</p></div></header><form className="deck-settings-card deck-create-page" onSubmit={submit}><label><span>Title</span><input autoFocus value={title} onChange={event => setTitle(event.target.value)} /></label><label><span>Description</span><textarea value={description} onChange={event => setDescription(event.target.value)} /></label><label><span>QR code</span><select value={qrCodeId} onChange={event => setQrCodeId(event.target.value)}><option value="">No QR code yet</option>{qrCodes.map((code) => <option key={code.id} value={code.id}>{code.name}</option>)}</select></label>{library.saveError && <p className="auth-error">{library.saveError}</p>}<div className="deck-settings-actions"><button type="button" onClick={onBack}>Cancel</button><button disabled={role === "viewer" || !title.trim() || library.isSaving}>{library.isSaving ? "Creating…" : "Create slide"}</button></div></form></>;
}
