import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLocally, cloudAiPreview } from "../lib/analyze.mjs";

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

test("bulut önizlemesinde e-posta ve telefonu varsayılan olarak maskeler", () => {
  const previous = process.env.AI_REDACT;
  delete process.env.AI_REDACT;
  try {
    const preview = cloudAiPreview({
      title: "İletişim",
      sender: "ogretmen@example.com",
      body: "Sorular için 0532 123 45 67 numarasını arayın."
    });
    assert.equal(preview.redactionEnabled, true);
    assert.doesNotMatch(preview.prepared.sender, /@/);
    assert.doesNotMatch(preview.prepared.body, /0532/);
    assert.match(preview.prepared.body, /TELEFON MASKELENDİ/);
  } finally {
    if (previous === undefined) delete process.env.AI_REDACT;
    else process.env.AI_REDACT = previous;
  }
});

test("kullanıcının özel ifadelerini büyük-küçük harf ve noktalama güvenli biçimde maskeler", () => {
  const preview = cloudAiPreview({
    title: "Ada (A.) için duyuru",
    sender: "ADA (A.)",
    body: "Ada (A.) geziye katılacaktır."
  }, { redactTerms: ["Ada (A.)"] });
  assert.equal(preview.customRedactionTerms, 1);
  assert.doesNotMatch(JSON.stringify(preview.prepared), /Ada|ADA/);
  assert.match(preview.prepared.body, /ÖZEL İFADE MASKELENDİ/);
});
