import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLocally, cloudAiPreview, normalizeAiAnalysis } from "../lib/analyze.mjs";

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

test("Türkçe karakterli sınırlarla tüm eğitim kategorilerini çıkarır", () => {
  const cases = [
    ["Sınav", "Matematik yazılısına çalışınız."],
    ["Ödev", "Türkçe ödevini yarın teslim ediniz."],
    ["Etkinlik", "Çarşamba günü müze gezisine katılınız."],
    ["Devamsızlık", "Öğrencimizin devamsızlık kaydı bulunmaktadır."],
    ["Ödeme", "Servis ücretini bugün ödeyiniz."],
    ["Malzeme", "Çantasında boya malzemelerini getirsin."]
  ];
  for (const [category, body] of cases) assert.equal(analyzeLocally({ title: "Bilgi", body }).category, category, body);
});

test("Türkçe gün, öncelik ve eylem köklerini ekleriyle tanır", () => {
  const result = analyzeLocally({
    title: "Önemlidir",
    body: "Çarşamba günü etkinliğe katılınız ve servis ücretini ödeyiniz."
  });
  assert.equal(result.priority, "yüksek");
  assert.deepEqual(result.dates.map(item => item.value), ["Çarşamba"]);
  assert.deepEqual(result.actionItems.map(item => item.text), ["Çarşamba günü etkinliğe katılınız ve servis ücretini ödeyiniz."]);
});

test("ödev sözcüğünü ödeme eylemi olarak yorumlamaz", () => {
  const result = analyzeLocally({ title: "Matematik ödevi", body: "Konu tekrarı yapılacaktır." });
  assert.equal(result.category, "Ödev");
  assert.deepEqual(result.actionItems, []);
});

test("AI analiz çıktısını sınırlı ve güvenilir şemaya dönüştürür", () => {
  const result = normalizeAiAnalysis({
    summary: `  ${"ö".repeat(1300)}  `,
    category: "Sınav",
    priority: "kritik",
    actionItems: [{ text: ` ${"g".repeat(600)} `, status: "tamamlandı", extra: "yok" }, { nested: true }, "Kitabı getir"],
    dates: [{ value: " 15.11.2030 ", certainty: "uydurma" }, "Pazartesi"],
    confidence: 8
  });
  assert.equal(result.summary.length, 1200);
  assert.equal(result.priority, "normal");
  assert.deepEqual(Object.keys(result.actionItems[0]), ["text", "status"]);
  assert.equal(result.actionItems[0].text.length, 500);
  assert.equal(result.actionItems[0].status, "açık");
  assert.equal(result.actionItems.length, 2);
  assert.deepEqual(result.dates, [
    { value: "15.11.2030", certainty: "metinde_geçiyor" },
    { value: "Pazartesi", certainty: "metinde_geçiyor" }
  ]);
  assert.equal(result.confidence, 1);
});
