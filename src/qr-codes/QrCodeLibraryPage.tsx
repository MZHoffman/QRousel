import { useMemo, useState } from "react";
import { QR_CODE_LIMIT } from "../../lib/qr-codes/creation";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import QrCodeCanvas from "./QrCodeCanvas";
import type { useQrCodeLibrary } from "./use-qr-code-library";
import type { IconSummary } from "../../lib/icons/api-response";
import type { User } from "firebase/auth";
import { archiveResource } from "../workspaces/trash-client";
import { qrPayload } from "./scan-url";

type Props = {
  library: ReturnType<typeof useQrCodeLibrary>;
  role: WorkspaceRole;
  icons: IconSummary[];
  onCreatePage: () => void;
  onEditPage: (qrCodeId: string) => void;
  user: User;
  workspaceId: string;
};

function EditGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16.5-.8 4.3 4.3-.8L19.2 8.3a2.2 2.2 0 0 0-3.1-3.1L4.4 16.9Z" /><path d="m14.8 6.5 2.7 2.7" /></svg>;
}

function TrashGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-9 0 1 13h10l1-13M10 11v5m4-5v5" /></svg>;
}

function PlusGlyph() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
}

export default function QrCodeLibraryPage({ library, role, icons, onCreatePage, onEditPage, user, workspaceId }: Props) {
  const [query, setQuery] = useState("");
  const canEdit = role !== "viewer";
  const codes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return library.codes;
    return library.codes.filter((code) => `${code.name} ${code.content}`.toLowerCase().includes(term));
  }, [library.codes, query]);

  const moveToTrash = (id: string, name: string) => {
    if (!window.confirm(`Move “${name}” to trash? It can be restored for 90 days.`)) return;
    void archiveResource(user, workspaceId, "qr-codes", id).then(() => window.location.reload());
  };

  return <>
    <header className="workspace-page-heading deck-library-heading">
      <div>
        <h1>QR codes</h1>
        <p>Create QR codes once and use them across your workspace.</p>
      </div>
    </header>
    <div className="deck-library-toolbar">
      <label><span className="visually-hidden">Search QR codes</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search QR codes" /></label>
      <span>{library.codes.length} / {QR_CODE_LIMIT} QR codes</span>
    </div>
    {library.status === "loading" && <section className="deck-library-status"><p>Loading QR codes…</p></section>}
    {library.status === "error" && <section className="deck-library-status"><h2>We could not load your QR codes</h2><p>{library.error}</p></section>}
    {library.status === "ready" && library.codes.length === 0 && <section className="workspace-library-empty"><span className="workspace-empty-mark deck-empty-mark">0</span><h2>No QR codes yet</h2><p>Create a code once, then reuse it across your workspace.</p>{canEdit && <button className="deck-empty-action" type="button" onClick={onCreatePage}>Create your first QR code</button>}</section>}
    {library.status === "ready" && library.codes.length > 0 && (codes.length === 0 ? <section className="deck-library-status"><h2>No matching QR codes</h2><p>Try a different search.</p></section> : <section className="qr-library-grid" aria-label="QR codes">
      {codes.map((code) => {
        const iconImage = icons.find((icon) => icon.id === code.iconId)?.imageDataUrl;
        return <article className="qr-library-card" key={code.id}>
          <div className="qr-library-art">
            <QrCodeCanvas content={qrPayload(code)} color={code.color} version={code.version} logoScale={code.logoScale} iconImage={iconImage} />
            {canEdit && <div className="qr-library-actions">
              <button type="button" title="Edit QR code" aria-label={`Edit ${code.name}`} onClick={() => onEditPage(code.id)}><EditGlyph /></button>
              <button className="qr-library-trash" type="button" title="Move to trash" aria-label={`Move ${code.name} to trash`} onClick={() => moveToTrash(code.id, code.name)}><TrashGlyph /></button>
            </div>}
          </div>
          <div className="qr-library-copy">
            <h2>{code.name}</h2>
            <p title={code.content}>{code.content}</p>
            <small><strong>{code.scanCount ?? 0}</strong> scans</small>
          </div>
        </article>;
      })}
      {canEdit && !query && <button className="qr-library-add" type="button" onClick={onCreatePage}><span><PlusGlyph /></span><strong>Add QR code</strong><small>Create a reusable code</small></button>}
    </section>)}
  </>;
}
