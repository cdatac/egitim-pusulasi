function escapeText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll(/\r?\n/g, "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function foldLine(line) {
  const parts = [];
  let current = "";
  let limit = 75;
  for (const character of line) {
    const candidate = current + character;
    if (Buffer.byteLength(candidate, "utf8") > limit && current) {
      parts.push(current);
      current = ` ${character}`;
      limit = 75;
    } else {
      current = candidate;
    }
  }
  parts.push(current);
  return parts.join("\r\n");
}

function explicitDate(value) {
  const text = String(value ?? "").trim();
  let year;
  let month;
  let day;
  let match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) {
    [, day, month, year] = match.map(Number);
  } else {
    match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    [, year, month, day] = match.map(Number);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, compact: `${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}` };
}

function nextDay(date) {
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));
  return `${value.getUTCFullYear()}${String(value.getUTCMonth() + 1).padStart(2, "0")}${String(value.getUTCDate()).padStart(2, "0")}`;
}

function stamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildCalendar(messages, { calendarName = "Eğitim Pusulası", generatedAt = new Date() } = {}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Egitim Pusulasi//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`
  ];
  const seen = new Set();
  let eventCount = 0;
  let omittedDateCount = 0;

  for (const message of messages) {
    for (const extracted of message.analysis?.dates ?? []) {
      const date = explicitDate(typeof extracted === "string" ? extracted : extracted.value);
      if (!date) {
        omittedDateCount += 1;
        continue;
      }
      const identity = `${message.id}:${date.compact}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const openTasks = (message.analysis?.actionItems ?? []).filter(item => !item.completed).map(item => item.text);
      const description = [
        message.analysis?.summary ?? message.body,
        openTasks.length ? `Açık görevler: ${openTasks.join(" | ")}` : "",
        `Kaynak ileti: #${message.id}`
      ].filter(Boolean).join("\n");
      lines.push(
        "BEGIN:VEVENT",
        `UID:message-${message.id}-${date.compact}@egitim-pusulasi.local`,
        `DTSTAMP:${stamp(generatedAt)}`,
        `DTSTART;VALUE=DATE:${date.compact}`,
        `DTEND;VALUE=DATE:${nextDay(date)}`,
        `SUMMARY:${escapeText(`${message.analysis?.category ?? "Okul"}: ${message.title}`)}`,
        `DESCRIPTION:${escapeText(description)}`,
        "TRANSP:TRANSPARENT",
        "END:VEVENT"
      );
      eventCount += 1;
    }
  }
  lines.push("END:VCALENDAR");
  return { content: `${lines.map(foldLine).join("\r\n")}\r\n`, eventCount, omittedDateCount };
}
