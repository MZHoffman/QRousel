import { useState, type FormEvent } from "react";
import { type QrCodeKind } from "../../lib/qr-codes/creation";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import type { useQrCodeLibrary } from "./use-qr-code-library";

function detect(value: string): QrCodeKind {
  if (/^https?:\/\//i.test(value)) return "url";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email";
  if (/^\+?[\d ()-]{7,}$/.test(value)) return "phone";
  if (/^WIFI:/i.test(value)) return "wifi";
  return "text";
}

export default function QrCodeCreatePage({ library, role, onBack }: { library: ReturnType<typeof useQrCodeLibrary>; role: WorkspaceRole; onBack: () => void }) {
  const [name, setName] = useState(""); const [value, setValue] = useState(""); const [kind, setKind] = useState<QrCodeKind>("url"); const [color, setColor] = useState("#173D2C"); const [version, setVersion] = useState(0);
  async function submit(event: FormEvent) { event.preventDefault(); if (await library.create({ name, kind, value, color, version })) onBack(); }
  return <><button className="deck-editor-back" onClick={onBack}><span>←</span> QR codes</button><header className="deck-editor-heading"><div><span className="deck-status">new QR code</span><h1>Create a QR code</h1><p>Paste content, then check the detected type and visual settings.</p></div></header><form className="deck-settings-card deck-create-page" onSubmit={submit}><label><span>Name</span><input autoFocus value={name} onChange={e => setName(e.target.value)} /></label><label><span>Content</span><input value={value} onChange={e => { setValue(e.target.value); setKind(detect(e.target.value)); }} placeholder="Paste a link, email, phone, Wi-Fi string, or text" /></label><label><span>Detected type</span><select value={kind} onChange={e => setKind(e.target.value as QrCodeKind)}>{["url","email","phone","wifi","text"].map(item => <option key={item}>{item}</option>)}</select></label><label><span>Colour</span><input value={color} pattern="#[0-9A-Fa-f]{6}" onChange={e => setColor(e.target.value)} /><input type="color" value={color} onChange={e => setColor(e.target.value)} /></label><label><span>Density: {version === 0 ? "Auto" : version}</span><input type="range" min="0" max="20" value={version} onChange={e => setVersion(Number(e.target.value))} /></label>{library.error && <p className="auth-error">{library.error}</p>}<div className="deck-settings-actions"><button type="button" onClick={onBack}>Cancel</button><button disabled={role === "viewer" || !name.trim() || !value.trim()}>Create QR code</button></div></form></>;
}
