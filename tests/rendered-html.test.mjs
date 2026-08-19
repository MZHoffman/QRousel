import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders QRousel metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>QRousel — Fifteen-second QR presentations<\/title>/i,
  );
  assert.match(
    html,
    /<meta(?=[^>]*\bname=["']description["'])(?=[^>]*\bcontent=["']Create a clean QR code slideshow with titles, descriptions, and automatic fifteen-second transitions\.["'])[^>]*>/i,
  );
  assert.match(html, /<link(?=[^>]*\brel=["']icon["'])(?=[^>]*\bhref=["']\/favicon\.svg["'])[^>]*>/i);
});

test("server-renders the QRousel presentation shell", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /<main class="app-shell">/i);
  assert.match(html, /<section class="stage" aria-live="polite">/i);
  assert.match(
    html,
    /<footer class="timer" aria-label="15 seconds remaining">/i,
  );
  assert.doesNotMatch(
    html,
    /codex-preview|Building your site|Your site is taking shape|react-loading-skeleton/i,
  );
});
