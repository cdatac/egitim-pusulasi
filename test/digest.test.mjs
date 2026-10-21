import test from "node:test";
import assert from "node:assert/strict";
import { buildDigest, DigestValidationError } from "../lib/digest.mjs";

const message = (id, occurredAt, options = {}) => ({
  id,
  title: options.title ?? `İleti ${id}`,
  body: options.body ?? "Kaynak metin",
  occurredAt,
  createdAt: occurredAt,
  analysis: {
    summary: options.summary ?? "Kaynaklı özet",
    category: options.category ?? "Duyuru",
    priority: options.priority ?? "normal",
    actionItems: options.actionItems ?? [],
    dates: options.dates ?? []
  }
});

test("haftalık özeti dönem, görev ve kaynak kimlikleriyle üretir", () => {
  const result = buildDigest([
    message(1, "2026-10-21T08:00:00+03:00", { category: "Ödev", priority: "yüksek", actionItems: [{ text: "Getir", status: "açık" }], dates: [{ value: "Cuma", certainty: "metinde_geçiyor" }] }),
    message(2, "2026-10-15T12:00:00+03:00", { category: "Etkinlik", actionItems: [{ text: "Tamamlandı", status: "tamamlandı", completed: true }] }),
    message(3, "2026-10-14T23:59:59+03:00", { category: "Sınav" })
  ], { period: "week", anchor: "2026-10-21" });

  assert.deepEqual(result.range, { from: "2026-10-15", to: "2026-10-21" });
  assert.equal(result.sourceCount, 2);
  assert.equal(result.urgentCount, 1);
  assert.equal(result.taskCount, 1);
  assert.deepEqual(result.items.map(item => item.messageId), [1, 2]);
  assert.equal(result.items[0].dates[0].value, "Cuma");
  assert.equal(result.items[1].openTaskCount, 0);
});

test("bugün görünümü yalnızca aynı takvim günündeki iletileri içerir", () => {
  const result = buildDigest([
    message(1, "2026-10-21T00:00:00+03:00"),
    message(2, "2026-10-20T23:59:59+03:00")
  ], { period: "today", anchor: "2026-10-21" });
  assert.equal(result.sourceCount, 1);
  assert.equal(result.items[0].messageId, 1);
});

test("geçersiz özet dönemi ve tarihi reddedilir", () => {
  assert.throws(() => buildDigest([], { period: "month" }), DigestValidationError);
  assert.throws(() => buildDigest([], { anchor: "geçersiz" }), DigestValidationError);
});
