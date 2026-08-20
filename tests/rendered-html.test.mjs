import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readBuiltDocument() {
  return readFile(new URL("../dist/index.html", import.meta.url), "utf8");
}

test("builds the QRousel document metadata", async () => {
  const html = await readBuiltDocument();
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

test("builds a Vite SPA entry", async () => {
  const html = await readBuiltDocument();

  assert.match(html, /<div id="root"><\/div>/i);
  assert.match(html, /<script[^>]+type="module"[^>]+src="\/assets\/[^"']+\.js"/i);
  assert.doesNotMatch(html, /__VINEXT_RSC/i);
  assert.doesNotMatch(
    html,
    /codex-preview|Building your site|Your site is taking shape|react-loading-skeleton/i,
  );
});
