import { useMemo, useState, type FormEvent } from "react";
import { type QrCodeKind } from "../../lib/qr-codes/creation";
import type { WorkspaceRole } from "../../lib/workspaces/api-response";
import type { useQrCodeLibrary } from "./use-qr-code-library";
import type { IconSummary } from "../../lib/icons/api-response";
import QrCodeCanvas from "./QrCodeCanvas";

function detect(value: string): QrCodeKind {
  if (/^https?:\/\//i.test(value)) return "url";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email";
  if (/^\+?[\d ()-]{7,}$/.test(value)) return "phone";
  if (/^WIFI:/i.test(value)) return "wifi";
  return "text";
}

function safety(scale: number) {
  return scale > 0.35 ? "Poor — may not scan" : scale > 0.28 ? "Fair — test before print" : "Excellent — safe";
}

export default function QrCodeCreatePage({ library, role, icons, onBack }: { library: ReturnType<typeof useQrCodeLibrary>; role: WorkspaceRole; icons: IconSummary[]; onBack: () => void }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [kind, setKind] = useState<QrCodeKind>("url");
  const [color, setColor] = useState("#000000");
  const [version, setVersion] = useState(0);
  const [iconId, setIconId] = useState("");
  const [logoScale, setLogoScale] = useState(0.25);
  const icon = useMemo(() => icons.find((item) => item.id === iconId), [iconId, icons]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await library.create({ name, kind, value, color, version, logoScale, iconId: iconId || null })) onBack();
  }

  return <>
    <button className="qr-editor-back" type="button" onClick={onBack}>
      <span aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="M15.5 10H4.5M9 5.5 4.5 10 9 14.5" /></svg></span>
      Back to QR codes
    </button>
    <header className="deck-editor-heading qr-editor-heading">
      <div>
        <span className="deck-status">new QR code</span>
        <h1>Create a QR code</h1>
        <p>Give it a name, paste the destination, then shape its look for a confident scan.</p>
      </div>
    </header>
    <form className="deck-settings-card qr-editor-page" onSubmit={submit}>
      <aside className="qr-preview-panel" aria-label="QR code preview">
        <div className="qr-preview-stage">
          <QrCodeCanvas content={value || " "} color={color} version={version} logoScale={logoScale} iconImage={icon?.imageDataUrl} />
        </div>
        <span>Preview</span>
      </aside>
      <section className="qr-editor-controls">
        <div className="qr-editor-fields">
          <label><span>Name</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Event registration" /></label>
          <label><span>Content</span><input value={value} onChange={(event) => { setValue(event.target.value); setKind(detect(event.target.value)); }} placeholder="Paste a link, email, phone, Wi-Fi string, or text" /></label>
          <label><span>Detected type</span><select value={kind} onChange={(event) => setKind(event.target.value as QrCodeKind)}>{["url", "email", "phone", "wifi", "text"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <fieldset className="qr-icon-picker">
            <legend>Centre mark</legend>
            <p>Optional. Keep it clear or select a reusable icon.</p>
            <div>
              <button className={`qr-icon-option qr-icon-option-empty${!iconId ? " is-selected" : ""}`} type="button" aria-label="No centre icon" title="No centre icon" onClick={() => setIconId("")}><span aria-hidden="true">×</span></button>
              {icons.map((item) => <button className={`qr-icon-option${item.id === iconId ? " is-selected" : ""}`} type="button" key={item.id} aria-label={item.name} title={item.name} onClick={() => setIconId(item.id)}><img src={item.imageDataUrl} alt="" /></button>)}
            </div>
          </fieldset>
          <div className="qr-appearance-grid">
            <label><span>Colour</span><div className="qr-colour-input"><input value={color} pattern="#[0-9A-Fa-f]{6}" aria-label="QR code colour hex value" onChange={(event) => setColor(event.target.value)} /><input type="color" value={color} aria-label="Choose QR code colour" onChange={(event) => setColor(event.target.value)} /></div></label>
            <label><span>Grid density <b>{version === 0 ? "Auto" : `V${version}`}</b></span><input type="range" min="0" max="20" value={version} onChange={(event) => setVersion(Number(event.target.value))} /><small>Auto selects the smallest reliable grid.</small></label>
          </div>
          <label className="qr-logo-size"><span>Centre mark size <b>{Math.round(logoScale * 100)}%</b></span><input type="range" min="0.1" max="0.5" step="0.01" value={logoScale} disabled={!iconId} onChange={(event) => setLogoScale(Number(event.target.value))} /><small className={logoScale > 0.35 ? "qr-safety qr-safety-poor" : logoScale > 0.28 ? "qr-safety qr-safety-fair" : "qr-safety"}>{iconId ? safety(logoScale) : "Choose a centre mark to control its size."}</small></label>
        </div>
        {library.error && <p className="auth-error">{library.error}</p>}
        <footer className="qr-editor-actions">
          <button type="button" onClick={onBack}>Cancel</button>
          <button type="submit" disabled={role === "viewer" || !name.trim() || !value.trim()}>Create QR code <span aria-hidden="true">→</span></button>
        </footer>
      </section>
    </form>
  </>;
}
