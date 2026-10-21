export class DigestValidationError extends Error {}

function parseDate(value) {
  if (value instanceof Date) return new Date(value);
  const text = String(value ?? "").trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  const sqliteTimestamp = text.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  return new Date(sqliteTimestamp ? `${text.replace(" ", "T")}Z` : text);
}

function validDate(value, label) {
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) throw new DigestValidationError(`${label} geçerli bir tarih olmalıdır`);
  return date;
}

function isoDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calendarDay(value) {
  const explicit = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return explicit?.[1] ?? isoDay(validDate(value, "İleti tarihi"));
}

export function buildDigest(messages, { period = "week", anchor = new Date() } = {}) {
  if (!["today", "week"].includes(period)) throw new DigestValidationError("Özet dönemi today veya week olmalıdır");
  const anchorDate = validDate(anchor, "Özet tarihi");
  const anchorDay = calendarDay(anchor);
  const start = parseDate(anchorDay);
  start.setDate(start.getDate() - (period === "today" ? 0 : 6));
  const startDay = isoDay(start);

  const included = messages.filter(message => {
    const value = message.occurredAt || message.createdAt;
    if (!value) return false;
    try {
      const day = calendarDay(value);
      return day >= startDay && day <= anchorDay;
    } catch {
      return false;
    }
  });

  const categoryMap = new Map();
  for (const message of included) {
    const category = message.analysis?.category ?? "İşlenmedi";
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + 1);
  }

  const openTasks = message => (message.analysis?.actionItems ?? []).filter(item => !item.completed && item.status !== "tamamlandı");

  const items = [...included]
    .sort((left, right) => {
      const priority = Number(right.analysis?.priority === "yüksek") - Number(left.analysis?.priority === "yüksek");
      if (priority) return priority;
      return parseDate(right.occurredAt || right.createdAt) - parseDate(left.occurredAt || left.createdAt);
    })
    .slice(0, 8)
    .map(message => ({
      messageId: message.id,
      title: message.title,
      summary: message.analysis?.summary ?? message.body,
      category: message.analysis?.category ?? "İşlenmedi",
      priority: message.analysis?.priority ?? "normal",
      actionItems: message.analysis?.actionItems ?? [],
      openTaskCount: openTasks(message).length,
      dates: message.analysis?.dates ?? [],
      occurredAt: message.occurredAt || message.createdAt
    }));

  return {
    period,
    label: period === "today" ? "Bugün alınan iletiler" : "Son 7 günde alınan iletiler",
    range: { from: startDay, to: anchorDay },
    sourceCount: included.length,
    urgentCount: included.filter(message => message.analysis?.priority === "yüksek").length,
    taskCount: included.reduce((sum, message) => sum + openTasks(message).length, 0),
    categories: [...categoryMap].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, "tr")),
    items,
    note: "Özet, iletilerin alınma tarihine göre hazırlanır. İçerikte geçen tarihler kaynakta yazıldığı biçimde gösterilir."
  };
}
