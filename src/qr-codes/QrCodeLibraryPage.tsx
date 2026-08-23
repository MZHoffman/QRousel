import { useMemo, useState } from "react";
import { QR_CODE_LIMIT } from "../../lib/qr-codes/creation";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import QrCodeCanvas from "./QrCodeCanvas";
import type { useQrCodeLibrary } from "./use-qr-code-library";

type Props = { library: ReturnType<typeof useQrCodeLibrary>; role: WorkspaceRole; onCreatePage: () => void };

export default function QrCodeLibraryPage({ library, role, onCreatePage }: Props) {
  const [query, setQuery] = useState("");
  const canEdit = role !== "viewer";
  const codes = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return library.codes;
    return library.codes.filter((code) => `${code.name} ${code.content}`.toLowerCase().includes(term));
  }, [library.codes, query]);

  return <>
    <header className="workspace-page-heading deck-library-heading"><div><p className="workspace-kicker">Scannable resources</p><h1>QR codes</h1><p>Generate reusable QR codes for every deck.</p></div>{canEdit && <button type="button" onClick={onCreatePage}>New QR code <span aria-hidden="true">→</span></button>}</header>
    <div className="deck-library-toolbar"><label><span className="visually-hidden">Search QR codes</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search QR codes" /></label><span>{library.codes.length} / {QR_CODE_LIMIT} QR codes</span></div>
    {library.status === "loading" && <section className="deck-library-status"><p>Loading QR codes…</p></section>}
    {library.status === "error" && <section className="deck-library-status"><h2>We could not load your QR codes</h2><p>{library.error}</p></section>}
    {library.status === "ready" && library.codes.length === 0 && <section className="workspace-library-empty"><span className="workspace-empty-mark deck-empty-mark">0</span><h2>No QR codes yet</h2><p>Create a code once, then reuse it across your workspace.</p>{canEdit && <button className="deck-empty-action" type="button" onClick={onCreatePage}>Create your first QR code</button>}</section>}
    {library.status === "ready" && library.codes.length > 0 && (codes.length === 0 ? <section className="deck-library-status"><h2>No matching QR codes</h2><p>Try a different search.</p></section> : <section className="slide-card-grid">{codes.map((code) => <article className="slide-card" key={code.id}><span className="deck-status">{code.kind}</span><h2>{code.name}</h2><p>{code.content}</p><QrCodeCanvas content={code.content} color={code.color} version={code.version} /></article>)}</section>)}
  </>;
}
