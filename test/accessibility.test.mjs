import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const html = readFileSync(path.join(root, "public", "index.html"), "utf8");
const css = readFileSync(path.join(root, "public", "styles.css"), "utf8");
const app = readFileSync(path.join(root, "public", "app.js"), "utf8");

test("sayfa dili, ana içerik geçişi ve canlı durum bölgeleri tanımlıdır", () => {
  assert.match(html, /<html lang="tr">/);
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(html, /<main id="main-content">/);
  assert.match(html, /id="ai-state"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="feed"[^>]*aria-live="polite"/);
});

test("statik form kontrollerinin görünür veya ekran okuyucu etiketi vardır", () => {
  const controls = [...html.matchAll(/<(?:input|textarea|select)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map(match => match[1]);
  assert.ok(controls.length >= 4);
  for (const id of controls) assert.match(html, new RegExp(`<label[^>]*for="${id}"`), `${id} etiketsiz`);
});

test("klavye odağı, azaltılmış hareket ve renkten bağımsız öncelik sunulur", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, />Öncelikli<\/span>/);
});
