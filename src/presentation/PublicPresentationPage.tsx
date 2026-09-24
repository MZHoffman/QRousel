import { useCallback, useEffect, useState } from "react";
import QrCodeCanvas from "../qr-codes/QrCodeCanvas";
import { qrPayload } from "../qr-codes/scan-url";

type Presentation = { deck: { id: string; name: string; defaultDisplayDurationSeconds: number }; slides: { id: string; title: string; description: string; displayDurationSeconds: number | null; qrCode: { id: string; content: string; kind: "url" | "email" | "phone" | "wifi" | "text"; color: string; version: number; logoScale?: number; iconImage: string | null } | null }[] };
type LoadState = { kind: "loading" } | { kind: "ready"; data: Presentation } | { kind: "passcode"; message: string } | { kind: "error"; message: string };

export default function PublicPresentationPage({ deckId }: { deckId: string }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [index, setIndex] = useState(0);
  const [passcode, setPasscode] = useState("");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [remaining, setRemaining] = useState(1);
  const load = useCallback(async (candidatePasscode = "") => {
    setState({ kind: "loading" });
    try {
      const response = await fetch(`/api/public/decks/${encodeURIComponent(deckId)}`, { headers: candidatePasscode ? { "x-presentation-passcode": candidatePasscode } : {} });
      const body: unknown = await response.json().catch(() => null);
      if (response.ok && body && typeof body === "object" && "deck" in body && "slides" in body && Array.isArray(body.slides)) { setIndex(0); setStartedAt(Date.now()); setRemaining(1); setState({ kind: "ready", data: body as Presentation }); return; }
      if (response.status === 401 && body && typeof body === "object" && "passcodeRequired" in body) { setState({ kind: "passcode", message: "Enter the passcode provided by the presenter." }); return; }
      setState({ kind: "error", message: body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "This presentation is unavailable." });
    } catch { setState({ kind: "error", message: "QRousel could not load this presentation." }); }
  }, [deckId]);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);
  const advance = useCallback((direction: 1 | -1) => { if (state.kind !== "ready" || state.data.slides.length === 0) return; setIndex((current) => (current + direction + state.data.slides.length) % state.data.slides.length); setStartedAt(Date.now()); setRemaining(1); }, [state]);
  useEffect(() => { if (state.kind !== "ready" || state.data.slides.length === 0) return; const onKeyDown = (event: KeyboardEvent) => { if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === " ") { event.preventDefault(); advance(1); } if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); advance(-1); } }; window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown); }, [advance, state]);
  useEffect(() => { if (state.kind !== "ready" || state.data.slides.length === 0) return; const duration = (state.data.slides[index]?.displayDurationSeconds ?? state.data.deck.defaultDisplayDurationSeconds) * 1000; const tick = window.setInterval(() => setRemaining(Math.max(0, 1 - (Date.now() - startedAt) / duration)), 50); const timer = window.setTimeout(() => advance(1), duration); return () => { window.clearInterval(tick); window.clearTimeout(timer); }; }, [advance, index, startedAt, state]);
  if (state.kind === "loading") return <main className="auth-shell"><section className="auth-card"><div className="auth-status"><h1>Loading presentation…</h1></div></section></main>;
  if (state.kind === "passcode") return <main className="auth-shell"><section className="auth-card"><a className="auth-brand" href="/">QRousel</a><form className="auth-status" onSubmit={(event) => { event.preventDefault(); void load(passcode); }}><p className="auth-eyebrow">Private presentation</p><h1>Enter passcode</h1><p>{state.message}</p><input className="presentation-passcode-input" autoFocus type="password" value={passcode} onChange={(event) => setPasscode(event.target.value)} /><button className="auth-primary-button" disabled={!passcode.trim()}>Open presentation</button></form></section></main>;
  if (state.kind === "error") return <main className="auth-shell"><section className="auth-card"><a className="auth-brand" href="/">QRousel</a><div className="auth-status"><p className="auth-eyebrow">Presentation unavailable</p><h1>We could not open this deck</h1><p>{state.message}</p><a className="auth-secondary-link" href="/">About QRousel</a></div></section></main>;
  const { data } = state, slide = data.slides[index];
  if (!slide) return <main className="auth-shell"><section className="auth-card"><div className="auth-status"><h1>No slides yet</h1><p>This presentation has no visible slides.</p></div></section></main>;
  return <main className="presentation-shell"><header className="presentation-header"><a href="/" className="presentation-brand">QRousel</a><span>{data.deck.name}</span><span>{index + 1} / {data.slides.length}</span></header><section className="presentation-stage" aria-live="polite"><article className="presentation-slide"><div className="presentation-qr">{slide.qrCode ? <QrCodeCanvas content={qrPayload(slide.qrCode)} color={slide.qrCode.color} version={slide.qrCode.version} logoScale={slide.qrCode.logoScale} iconImage={slide.qrCode.iconImage ?? undefined} /> : <div className="presentation-no-qr">No QR code</div>}</div><div className="presentation-copy"><p className="presentation-kicker">Scan to explore</p><h1>{slide.title}</h1>{slide.description && <p>{slide.description}</p>}<small>Use ← and → to change slides</small></div></article></section><div className="presentation-progress" aria-label="Time until next slide"><span style={{ transform: `scaleX(${remaining})` }} /></div></main>;
}
