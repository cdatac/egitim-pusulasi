import test from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyLearningMap, WeeklyLearningValidationError } from "../lib/weekly-learning.mjs";

const message = (id, title, body, occurredAt, actionItems = [], category = "Duyuru") => ({
  id,
  title,
  body,
  occurredAt,
  createdAt: occurredAt,
  analysis: { summary: body, category, actionItems, dates: [] }
});

test("haftanın iletilerinden ders bazlı kazanım ve ödev kontrolü çıkarır", () => {
  const result = buildWeeklyLearningMap([
    message(1, "Bu hafta işlenen konular", "Matematik: Kesirlerde toplama işlemini işledik.\nFen Bilimleri: Kuvvet ve hareket konusunu çalıştık.", "2026-10-23T15:00:00+03:00"),
    message(2, "Hafta sonu ödevi", "Matematik kesirler çalışma kağıdı tamamlanacak.", "2026-10-23T16:00:00+03:00", [
      { key: "task-1", text: "Matematik kesirler çalışma kağıdını tamamla", completed: false }
    ], "Ödev"),
    message(3, "Eski ileti", "Matematik: Çarpma", "2026-10-12T10:00:00+03:00")
  ], { anchor: "2026-10-23" });

  assert.deepEqual(result.range, { from: "2026-10-19", to: "2026-10-25" });
  assert.equal(result.sourceCount, 2);
  assert.ok(result.learnings.some(item => item.subject === "Matematik" && /Kesirlerde toplama/i.test(item.text)));
  assert.ok(result.learnings.some(item => item.subject === "Fen Bilimleri" && /Kuvvet ve hareket/i.test(item.text)));
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].match.status, "olası eşleşme");
  assert.equal(result.progress.openTasks, 1);
  assert.deepEqual(result.sourceMessageIds, [1, 2]);
});

test("uydurma kazanım üretmez ve belirsiz ödevi kontrole bırakır", () => {
  const result = buildWeeklyLearningMap([
    message(1, "Hafta sonu ödevi", "İngilizce çalışma kitabı sayfa 12 yapılacak.", "2026-10-23T16:00:00+03:00", [
      { key: "task-1", text: "İngilizce çalışma kitabı sayfa 12", completed: true }
    ], "Ödev")
  ], { anchor: "2026-10-23" });
  assert.equal(result.learnings.length, 0);
  assert.equal(result.tasks[0].match.status, "kontrol edilmeli");
  assert.equal(result.progress.completedTasks, 1);
});

test("geçersiz hafta tarihini reddeder", () => {
  assert.throws(() => buildWeeklyLearningMap([], { anchor: "geçersiz" }), WeeklyLearningValidationError);
  assert.throws(() => buildWeeklyLearningMap([], { anchor: "2026-02-31" }), WeeklyLearningValidationError);
});

test("Türkçe karakterli ders ve sinyalleri algılar, selam ve imzayı kazanım yapmaz", () => {
  const result = buildWeeklyLearningMap([
    message(1, "Bu hafta öğrendiklerimiz", "Sevgili velilerimiz merhaba.\nİngilizce: Unit 3 kelimelerini öğrendik.\nDin Kültürü: Yardımlaşma konusunu işledik.\nVeli toplantımız perşembe 18.00'de yapılacaktır.\nSaygılarımızla, sınıf öğretmeni", "2026-10-23T15:00:00+03:00")
  ], { anchor: "2026-10-23" });
  assert.deepEqual(result.learnings.map(item => item.subject).sort(), ["Din Kültürü", "İngilizce"]);
  assert.ok(result.learnings.every(item => !/veli|saygı|öğretmen/i.test(item.text)));
});

test("toplantı görevini toplama kazanımıyla yüksek güvenle eşleştirmez", () => {
  const result = buildWeeklyLearningMap([
    message(1, "Matematik kazanımları", "Matematik: Toplama işlemi problemlerini işledik.", "2026-10-23T15:00:00+03:00"),
    message(2, "Veli toplantısı", "Toplantıya katılınız.", "2026-10-23T16:00:00+03:00", [{ key: "t", text: "Toplantıya katılınız", completed: false }])
  ], { anchor: "2026-10-23" });
  assert.notEqual(result.tasks[0].match.status, "eşleşti");
});

test("ders ve öğrenme köklerini ilgisiz sözcüklerin içinde eşleştirmez", () => {
  const result = buildWeeklyLearningMap([
    message(1, "Kulüp duyurusu", "Fenerbahçe müzesi hakkında konuşma toplantısı yapılacaktır.", "2026-10-23T15:00:00+03:00")
  ], { anchor: "2026-10-23" });
  assert.equal(result.learnings.length, 0);
  assert.equal(result.subjects.some(item => item.subject === "Fen Bilimleri"), false);
});

test("genel veli ifadelerini kazanım saymaz ve özgün harf yapısını korur", () => {
  const result = buildWeeklyLearningMap([
    message(1, "Matematik haftası", "Bu konuda desteğinizi bekliyoruz.\nMatematik: Özel İsimleri ve Kesirleri işledik.", "2026-10-23T15:00:00+03:00")
  ], { anchor: "2026-10-23" });
  assert.equal(result.learnings.length, 1);
  assert.match(result.learnings[0].text, /Özel İsimleri ve Kesirleri/);
  assert.doesNotMatch(result.learnings[0].text, /desteğinizi/);
});

test("saat dilimi olmayan K12 zamanını İstanbul saati kabul eder", () => {
  const result = buildWeeklyLearningMap([
    message(1, "Matematik kazanımları", "Matematik: Kesirleri işledik.", "2026-10-25T23:30:00")
  ], { anchor: "2026-10-25" });
  assert.equal(result.sourceCount, 1);
});

test("İstanbul saatine göre pazartesiye geçen iletiyi doğru haftaya alır", () => {
  const result = buildWeeklyLearningMap([
    message(1, "Matematik kazanımları", "Matematik: Kesirleri işledik.", "2026-10-25T22:30:00Z")
  ], { anchor: "2026-10-26" });
  assert.equal(result.sourceCount, 1);
  assert.deepEqual(result.range, { from: "2026-10-26", to: "2026-11-01" });
});

test("analiz yoksa ödev gövdesini başlık yerine kontrol maddesi yapar", () => {
  const result = buildWeeklyLearningMap([
    message(1, "Hafta sonu", "Ödev: Problemleri çözünüz.", "2026-10-23T16:00:00+03:00", [])
  ], { anchor: "2026-10-23" });
  assert.match(result.tasks[0].text, /problemleri çözünüz/i);
  assert.doesNotMatch(result.tasks[0].text, /hafta sonu/i);
});
