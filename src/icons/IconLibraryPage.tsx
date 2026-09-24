import { useMemo, useState } from "react";
import { ICON_LIMIT } from "../../lib/icons/creation";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import type { useIconLibrary } from "./use-icon-library";
import type { User } from "firebase/auth";
import { archiveResource } from "../workspaces/trash-client";

export default function IconLibraryPage({ library, role, onCreatePage, user, workspaceId }: { library: ReturnType<typeof useIconLibrary>; role: WorkspaceRole; onCreatePage: () => void; user: User; workspaceId: string }) {
  const [query, setQuery] = useState("");
  const canEdit = role !== "viewer";
  const icons = useMemo(() => { const term = query.trim().toLowerCase(); return term ? library.icons.filter((icon) => icon.name.toLowerCase().includes(term)) : library.icons; }, [library.icons, query]);
  return <><header className="workspace-page-heading deck-library-heading"><div><p className="workspace-kicker">Visual library</p><h1>Icons</h1><p>Reusable centre marks for QR codes in this workspace.</p></div></header><div className="deck-library-toolbar"><label><span className="visually-hidden">Search icons</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search icons" /></label><span>{library.icons.length} / {ICON_LIMIT} icons</span></div>{library.state === "loading" && <section className="deck-library-status"><p>Loading icons…</p></section>}{library.state === "error" && <section className="deck-library-status"><h2>We could not load your icons</h2><p>{library.error}</p></section>}{library.state === "ready" && (icons.length === 0 && query ? <section className="deck-library-status"><h2>No matching icons</h2><p>Try a different search.</p></section> : <section className="icon-library-grid">{icons.map((icon) => <article className="icon-library-card" key={icon.id}><div className="icon-library-art"><img src={icon.imageDataUrl} alt="" /></div><h2>{icon.name}</h2>{canEdit && <button className="workspace-text-button" type="button" onClick={() => { if (window.confirm(`Archive “${icon.name}”?`)) void archiveResource(user, workspaceId, "icons", icon.id).then(() => window.location.reload()); }}>Archive</button>}</article>)}{canEdit && !query && <button className="icon-library-add" type="button" onClick={onCreatePage}><span aria-hidden="true">+</span><strong>Add icon</strong></button>}</section>)}</>;
}
