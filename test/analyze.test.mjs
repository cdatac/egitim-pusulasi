import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLocally } from "../lib/analyze.mjs";

test("ödev, tarih ve yapılacak işi kaynağa bağlı çıkarır", () => {
  const result = analyzeLocally({
    title: "Fen projesi",
    body: "23.10.2026 tarihine kadar projeyi teslim ediniz. Karton ve LED getiriniz."
  });

  assert.equal(result.category, "Ödev");
  assert.equal(result.priority, "normal");
  assert.deepEqual(result.dates.map(item => item.value), ["23.10.2026"]);
  assert.equal(result.actionItems.length, 2);
  assert.match(result.summary, /23\.10\.2026/);
  assert.equal(result.provider, "yerel-kural");
});

test("acil veya yakın zaman ifadesini yüksek öncelik yapar", () => {
  const result = analyzeLocally({ title: "Önemli", body: "Yarın veli toplantısına katılınız." });
  assert.equal(result.priority, "yüksek");
  assert.equal(result.category, "Etkinlik");
  assert.deepEqual(result.dates.map(item => item.value), ["Yarın"]);
});

test("mesajda olmayan tarih veya görev üretmez", () => {
  const result = analyzeLocally({ title: "Bilgilendirme", body: "Yeni döneminiz kutlu olsun." });
  assert.equal(result.category, "Duyuru");
  assert.deepEqual(result.dates, []);
  assert.deepEqual(result.actionItems, []);
});
