export const MAX_NOTIFICATION_EXPORT_BYTES = 1_000_000;

export function parseNotificationExportText(text) {
  const payload = JSON.parse(text);
  const records = Array.isArray(payload) ? payload : payload?.records;
  if (!Array.isArray(records)) throw new Error("Dosyada records dizisi bulunamadı.");
  return records;
}
