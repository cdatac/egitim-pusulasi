import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendar, buildPlannerCalendar } from "../lib/calendar.mjs";

test("yalnızca açık ve geçerli tam tarihleri kaynaklı takvim olayına dönüştürür", () => {
  const result = buildCalendar([{
    id: 42,
    title: "Fen; projesi",
    body: "Kaynak",
    analysis: {
      summary: "Projeyi teslim edin.",
      category: "Ödev",
      dates: [{ value: "23.10.2026" }, { value: "Cuma" }, { value: "31.02.2026" }],
      actionItems: [{ text: "LED getir", completed: false }, { text: "Karton hazırla", completed: true }]
    }
  }], { calendarName: "Çocuğum", generatedAt: "2026-10-21T10:00:00Z" });
  const unfolded = result.content.replace(/\r\n[ \t]/g, "");

  assert.equal(result.eventCount, 1);
  assert.equal(result.omittedDateCount, 2);
  assert.match(result.content, /DTSTART;VALUE=DATE:20261023\r\n/);
  assert.match(result.content, /DTEND;VALUE=DATE:20261024\r\n/);
  assert.match(unfolded, /SUMMARY:Ödev: Fen\\; projesi/);
  assert.match(unfolded, /LED getir/);
  assert.doesNotMatch(unfolded, /Karton hazırla/);
  assert.match(unfolded, /Kaynak ileti: #42/);
  assert.ok(result.content.endsWith("END:VCALENDAR\r\n"));
});

test("aynı iletide tekrarlanan tarih için tek olay üretir", () => {
  const result = buildCalendar([{
    id: 7,
    title: "Sınav",
    body: "",
    analysis: { category: "Sınav", dates: ["2026-11-05", { value: "2026-11-05" }], actionItems: [] }
  }], { generatedAt: "2026-10-21T10:00:00Z" });
  assert.equal(result.eventCount, 1);
  assert.equal((result.content.match(/BEGIN:VEVENT/g) ?? []).length, 1);
});

test("uzun UTF-8 satırlarını 75 baytı aşmadan katlar", () => {
  const result = buildCalendar([{
    id: 1,
    title: "Çok uzun Türkçe başlık ".repeat(8),
    body: "",
    analysis: { category: "Duyuru", dates: [{ value: "01.12.2026" }], actionItems: [] }
  }], { generatedAt: "2026-10-21T10:00:00Z" });
  for (const line of result.content.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75);
});

test("haftalık plan tarihli olayları ve yapılacak kontrol listesini birlikte dışa aktarır", () => {
  const result = buildPlannerCalendar([{
    id: 9,
    title: "Hafta sonu ödevi",
    body: "Kaynak",
    analysis: {
      category: "Ödev",
      summary: "Kesir çalışma kağıdı",
      dates: [{ value: "25.10.2026" }],
      actionItems: [
        { key: "a1", text: "Kesir çalışma kağıdını bitir", completed: false },
        { key: "a2", text: "Kitabı oku", completed: true }
      ]
    }
  }], { generatedAt: "2026-10-23T17:00:00Z" });
  const unfolded = result.content.replace(/\r\n[ \t]/g, "");
  assert.equal(result.eventCount, 1);
  assert.equal(result.taskCount, 2);
  assert.match(unfolded, /BEGIN:VTODO/);
  assert.match(unfolded, /SUMMARY:Kesir çalışma kağıdını bitir/);
  assert.match(unfolded, /DUE;VALUE=DATE:20261025/);
  assert.match(unfolded, /STATUS:NEEDS-ACTION/);
  assert.match(unfolded, /STATUS:COMPLETED/);
});
