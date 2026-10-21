import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestionPreview, QaValidationError, selectQuestionSources } from "../lib/qa.mjs";

const messages = [
  { id: 1, title: "Fen ödevi", body: "Cuma günü projeyi teslim ediniz.", occurredAt: "2026-10-21", analysis: { category: "Ödev", summary: "Fen projesi teslimi", actionItems: [{ text: "Projeyi teslim et" }], dates: [{ value: "Cuma" }] } },
  { id: 2, title: "Servis ödemesi", body: "Servis ücretini ödeyiniz.", occurredAt: "2026-10-20", analysis: { category: "Ödeme", summary: "Servis ücreti", actionItems: [], dates: [] } },
  { id: 3, title: "Eski duyuru", body: "Genel bilgi", occurredAt: "2026-10-19", analysis: { category: "Duyuru", summary: "Genel", actionItems: [], dates: [] } }
];

test("soruya en ilgili kaynakları yerelde sıralar", () => {
  assert.deepEqual(selectQuestionSources("Fen projesi ne zaman teslim?", messages).map(item => item.id), [1]);
  assert.deepEqual(selectQuestionSources("Servis ödemesi nedir?", messages).map(item => item.id), [2]);
  assert.deepEqual(selectQuestionSources("Bu hafta neler var?", messages).map(item => item.id), [1, 2, 3]);
});

test("soru ve seçilen kaynakları bulut önizlemesinde maskeler", () => {
  const preview = buildQuestionPreview("Ada'nın fen ödevi nedir?", [{ ...messages[0], body: "Ada için 0532 123 45 67 aranmalıdır." }], { redactTerms: ["Ada"] });
  assert.equal(preview.sources.length, 1);
  assert.equal(preview.customRedactionTerms, 1);
  assert.doesNotMatch(JSON.stringify(preview.prepared), /Ada|0532/);
  assert.match(JSON.stringify(preview.prepared), /ÖZEL İFADE MASKELENDİ|TELEFON MASKELENDİ/);
});

test("çok kısa, çok uzun veya ilgisiz soru kaynak göndermez", () => {
  assert.throws(() => selectQuestionSources("ne", messages), QaValidationError);
  assert.throws(() => selectQuestionSources("x".repeat(501), messages), QaValidationError);
  assert.deepEqual(selectQuestionSources("kantin menüsü", messages), []);
});
