import { useState, type FormEvent } from "react";
import { QR_CODE_KINDS, QR_CODE_LIMIT, type QrCodeKind } from "../../lib/qr-codes/creation";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import QrCodeCanvas from "./QrCodeCanvas";
import type { useQrCodeLibrary } from "./use-qr-code-library";

export default function QrCodeLibraryPage({ library, role }: { library: ReturnType<typeof useQrCodeLibrary>; role: WorkspaceRole }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<QrCodeKind>("url");
  const [value, setValue] = useState("");
  const [color, setColor] = useState("#173D2C");
  const [version, setVersion] = useState(0);
  const canEdit = role !== "viewer";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await library.create({ name, kind, value, color, version })) {
      setOpen(false); setName(""); setValue("");
    }
  }
  return <><header className="workspace-page-heading deck-library-heading"><div><p className="workspace-kicker">Scannable resources</p><h1>QR codes</h1><p>Generate reusable QR codes for every deck.</p></div>{canEdit && <button type="button" onClick={() => setOpen(true)}>New QR code <span aria-hidden="true">→</span></button>}</header><div className="deck-library-toolbar"><span>{library.codes.length} / {QR_CODE_LIMIT} QR codes</span></div>{library.status === "loading" && <section className="deck-library-status"><p>Loading QR codes…</p></section>}{library.status === "error" && <section className="deck-library-status"><h2>We could not load your QR codes</h2><p>{library.error}</p></section>}{library.status === "ready" && library.codes.length === 0 && <section className="workspace-library-empty"><span className="workspace-empty-mark deck-empty-mark">0</span><h2>No QR codes yet</h2><p>Create a code once, then reuse it across your workspace.</p>{canEdit && <button className="deck-empty-action" onClick={() => setOpen(true)}>Create your first QR code</button>}</section>}{library.codes.length > 0 && <section className="slide-card-grid">{library.codes.map((code) => <article className="slide-card" key={code.id}><span className="deck-status">QR code</span><h2>{code.name}</h2><p>{code.content}</p><QrCodeCanvas content={code.content} color={code.color} version={code.version} /></article>)}</section>}{open && <div className="deck-dialog-backdrop"><section className="deck-dialog" role="dialog" aria-modal="true"><button className="deck-dialog-close" onClick={() => setOpen(false)}>×</button><p className="workspace-kicker">Scannable resource</p><h2>Create a QR code</h2><form onSubmit={submit}><label><span>Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label><label><span>Content type</span><select value={kind} onChange={(event) => setKind(event.target.value as QrCodeKind)}>{QR_CODE_KINDS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label><span>Content</span><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://example.com" /></label><label><span>Colour</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><label><span>Density (auto is 0)</span><input type="number" min="0" max="20" value={version} onChange={(event) => setVersion(Number(event.target.value))} /></label>{library.error && <p className="auth-error">{library.error}</p>}<div><button type="button" onClick={() => setOpen(false)}>Cancel</button><button disabled={!name.trim() || !value.trim()} type="submit">Create QR code</button></div></form></section></div>}</>;
}
