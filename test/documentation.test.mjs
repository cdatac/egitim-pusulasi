import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const markdownFiles = [
  "README.md",
  "PRIVACY.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "ROADMAP.md",
  "docs/CONNECTORS.md",
  "docs/INSTALL.md",
  "docs/RELEASE.md",
  "docs/THREAT_MODEL.md",
  "docs/USER_GUIDE.md"
];

test("Türkçe kullanıcı rehberi temel ebeveyn iş akışlarını kapsar", () => {
  const guide = readFileSync(path.join(root, "docs", "USER_GUIDE.md"), "utf8");
  for (const heading of ["Başlatma ve ilk kurulum", "Çocuk profilleri", "Özetler, arama ve görevler", "AI seçenekleri ve onay", "Veriyi indirme ve silme", "Sorun giderme"]) {
    assert.match(guide, new RegExp(`^## .*${heading}`, "m"), heading);
  }
  assert.match(guide, /özgün ileti/i);
  assert.match(guide, /gerçek çocuk verisi/i);
});

test("depo içindeki Markdown bağlantıları var olan dosyalara gider", () => {
  for (const relativeFile of markdownFiles) {
    const sourcePath = path.join(root, relativeFile);
    assert.equal(existsSync(sourcePath), true, relativeFile);
    const content = readFileSync(sourcePath, "utf8");
    for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].trim().replace(/^<|>$/g, "").split("#", 1)[0];
      if (!target || /^(?:https?:|mailto:)/i.test(target)) continue;
      const resolved = path.resolve(path.dirname(sourcePath), decodeURIComponent(target));
      assert.equal(existsSync(resolved), true, `${relativeFile} -> ${target}`);
    }
  }
});

test("kamusal belgeler bağımsızlığı ve K12 bildirim veri minimizasyonunu açıklar", () => {
  const readme = readFileSync(path.join(root, "README.md"), "utf8");
  const privacy = readFileSync(path.join(root, "PRIVACY.md"), "utf8");
  const security = readFileSync(path.join(root, "SECURITY.md"), "utf8");
  assert.match(readme, /K12 veya okulunuzla resmî bağlantısı yoktur/);
  assert.match(readme, /bildirim JSON dosyasını/);
  assert.match(privacy, /intent.*portal.*query/s);
  assert.match(privacy, /K12'ye ağ isteği göndermez/);
  assert.match(security, /kimlik bilgisi alanı bulunan kayıtları reddeder/);
});
