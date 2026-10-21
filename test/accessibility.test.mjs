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

test("ana arka plandaki ikincil metin WCAG AA kontrast eşiğini karşılar", () => {
  const color = name => css.match(new RegExp(`--${name}:#([0-9a-f]{6})`, "i"))?.[1];
  const luminance = hex => {
    const channels = hex.match(/../g).map(value => Number.parseInt(value, 16) / 255);
    const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };

  assert.ok(contrast(color("muted"), color("paper")) >= 4.5);
});

test("dar ekranda özet kartları kompakt bir satırda kalır", () => {
  assert.match(css, /@media \(max-width:720px\)[\s\S]*\.stats \{ grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test("klavye odağı, azaltılmış hareket ve renkten bağımsız öncelik sunulur", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, />Öncelikli<\/span>/);
});
