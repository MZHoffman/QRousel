const appPath = (intent: "sign-in" | "create-account") =>
  `/app?intent=${intent}`;

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Main navigation">
        <a className="landing-brand" href="/">QRousel</a>
        <div>
          <a href={appPath("sign-in")}>Sign in</a>
          <a className="landing-nav-cta" href={appPath("create-account")}>Create account</a>
        </div>
      </nav>

      <section className="landing-hero">
        <div>
          <p className="landing-kicker">QR presentations, made calm</p>
          <h1>Put the right QR code in front of the right people.</h1>
          <p className="landing-lede">QRousel turns your links, messages, Wi-Fi details, and event information into a polished, automatically rotating presentation.</p>
          <div className="landing-actions">
            <a className="landing-primary" href={appPath("create-account")}>Create your workspace <span aria-hidden="true">→</span></a>
            <a className="landing-secondary" href={appPath("sign-in")}>Sign in</a>
          </div>
          <p className="landing-note">Free beta · Google sign-in · No card required</p>
        </div>
        <div className="landing-demo" aria-label="QRousel presentation preview">
          <div className="landing-demo-qr" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <div className="landing-demo-copy"><span>NOW SHOWING</span><h2>Welcome to the event</h2><p>Scan for the agenda, speaker details, and venue map.</p></div>
          <div className="landing-demo-progress"><span /></div>
        </div>
      </section>

      <section className="landing-steps" aria-label="How QRousel works">
        <p className="landing-kicker">How it works</p>
        <div>
          <article><span>01</span><h2>Build your library</h2><p>Create reusable QR codes, icons, and slides in one workspace.</p></article>
          <article><span>02</span><h2>Arrange a deck</h2><p>Bring slides together and choose the timing for your presentation.</p></article>
          <article><span>03</span><h2>Present anywhere</h2><p>Open your clean deck on a display and let QRousel do the rotation.</p></article>
        </div>
      </section>
    </main>
  );
}
