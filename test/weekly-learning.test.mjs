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

test("cuma iletilerinden ders bazlı kazanım ve ödev kontrolü çıkarır", () => {
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
  assert.equal(result.tasks[0].match.status, "eşleşti");
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
});
