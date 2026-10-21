import test from "node:test";
import assert from "node:assert/strict";
import { MAX_NOTIFICATION_EXPORT_BYTES, parseNotificationExportText } from "../public/import-utils.js";

test("bildirim dışa aktarımı dizi veya records zarfını kabul eder", () => {
  const record = { title: "Sentetik", message: "Sentetik içerik" };
  assert.deepEqual(parseNotificationExportText(JSON.stringify([record])), [record]);
  assert.deepEqual(parseNotificationExportText(JSON.stringify({ records: [record] })), [record]);
});

test("bildirim dışa aktarımı belirsiz JSON biçimini reddeder", () => {
  assert.throws(() => parseNotificationExportText("{}"), /records dizisi/);
  assert.throws(() => parseNotificationExportText("geçersiz"), SyntaxError);
  assert.equal(MAX_NOTIFICATION_EXPORT_BYTES, 1_000_000);
});
