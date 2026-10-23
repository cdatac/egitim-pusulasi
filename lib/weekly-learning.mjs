export class WeeklyLearningValidationError extends Error {}

const SUBJECTS = [
  ["Türkçe", ["türkçe", "okuma", "yazma", "dil bilgisi"]],
  ["Matematik", ["matematik", "geometri"]],
  ["Fen Bilimleri", ["fen bilimleri", "fen", "bilim"]],
  ["Sosyal Bilgiler", ["sosyal bilgiler", "sosyal"]],
  ["İngilizce", ["ingilizce", "english"]],
  ["Hayat Bilgisi", ["hayat bilgisi"]],
  ["Din Kültürü", ["din kültürü", "din dersi"]],
  ["Bilişim", ["bilişim", "kodlama", "teknoloji"]],
  ["Görsel Sanatlar", ["görsel sanatlar", "resim"]],
  ["Müzik", ["müzik"]],
  ["Beden Eğitimi", ["beden eğitimi", "spor"]],
  ["Rehberlik", ["rehberlik"]]
];

const LEARNING_TERMS = ["kazanım", "işlenen konu", "öğrendik", "öğrenilecek", "öğrenme", "çalıştık", "işledik"];
const HOMEWORK_TERMS = ["ödev", "hafta sonu", "çalışma kağıdı", "çalışma kâğıdı", "sayfa", "soru", "test", "okuyunuz", "yapınız", "tamamlayınız", "çözünüz", "hazırlayınız", "tekrar"];
const ACTIVITY_TERMS = ["etkinlik", "gezi", "toplantı", "kulüp", "gösteri", "turnuva", "proje", "sunum", "atölye"];
const STOP_WORDS = new Set("ve veya ile için bir bu şu o da de mı mi mu mü hafta haftalık sonu ders dersinde konusu konular kazanım kazanımlar ödev çalışma yapılacak yapınız ediniz olan olarak öğrenci öğrenciler".split(" "));
const ISTANBUL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });

function normalized(value) {
  return String(value ?? "").normalize("NFC").toLocaleLowerCase("tr-TR");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

function termPattern(term, flags = "u") {
  const suffix = "(?:l[ae]r)?(?:[ıiuü]|y[ıiuü])?(?:m[ıiuü]z|n[ıiuü]z)?(?:d[ae]|t[ae]|d[ae]n|t[ae]n)?";
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(normalized(term))}${suffix}(?![\\p{L}\\p{N}])`, flags);
}

function hasAny(value, terms) {
  const text = normalized(value);
  return terms.some(term => termPattern(term).test(text));
}

function removeTerms(value, terms) {
  let result = String(value ?? "").normalize("NFC");
  for (const term of terms) {
    const normalizedResult = normalized(result);
    const ranges = [...normalizedResult.matchAll(termPattern(term, "gu"))].map(match => [match.index, match.index + match[0].length]);
    for (const [start, end] of ranges.reverse()) result = `${result.slice(0, start)} ${result.slice(end)}`;
  }
  return result;
}

function parseDate(value) {
  const text = String(value ?? "").trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [year, month, day] = dateOnly.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new WeeklyLearningValidationError("Hafta tarihi geçerli olmalıdır");
    }
    return date;
  }
  const timezoneLess = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/.test(text);
  const date = new Date(timezoneLess ? `${text.replace(" ", "T")}+03:00` : text);
  if (Number.isNaN(date.getTime())) throw new WeeklyLearningValidationError("Hafta tarihi geçerli olmalıdır");
  return date;
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function dayFromValue(value) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return isoDay(parseDate(text));
  const date = parseDate(text);
  const parts = Object.fromEntries(ISTANBUL_DAY.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function weekRange(anchor) {
  const date = parseDate(anchor);
  const dayText = /^\d{4}-\d{2}-\d{2}$/.test(String(anchor)) ? String(anchor) : dayFromValue(date);
  const day = parseDate(dayText);
  const start = new Date(day);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return { from: isoDay(start), to: isoDay(end) };
}

function cleanLine(value) {
  return String(value ?? "").replace(/^[\s•●▪◦*\-–—\d.)]+/u, "").replace(/\s+/g, " ").trim();
}

function splitLines(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n|(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ0-9])/u)
    .map(cleanLine)
    .filter(line => line.length >= 3);
}

function subjectFor(value) {
  return SUBJECTS.find(([, terms]) => hasAny(value, terms))?.[0] ?? null;
}

function stripSubjectPrefix(line, subject) {
  if (!subject) return cleanLine(line);
  const terms = SUBJECTS.find(([name]) => name === subject)?.[1] ?? [subject];
  const original = String(line ?? "").normalize("NFC");
  const normalizedLine = normalized(original);
  for (const term of terms) {
    const match = normalizedLine.match(new RegExp(`^\\s*${escapeRegex(normalized(term))}(?:l[ae]r)?(?:[ıiuü]|y[ıiuü])?(?:d[ae]|t[ae])?\\s*[:\\-–—]?\\s*`, "u"));
    if (match) return cleanLine(original.slice(match[0].length));
  }
  return cleanLine(original);
}

function uniqueByText(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = `${row.messageId}\0${row.subject}\0${normalized(row.text)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tokens(value) {
  return new Set(normalized(value)
    .replace(/[^a-z0-9çğıöşü\s]/giu, " ")
    .split(/\s+/)
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token)));
}

function overlap(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return { score: 0, shared: 0 };
  const equivalent = (leftToken, rightToken) => leftToken === rightToken || (leftToken.length >= 7 && rightToken.length >= 7 && leftToken.slice(0, 6) === rightToken.slice(0, 6));
  const shared = [...a].filter(token => [...b].some(other => equivalent(token, other))).length;
  return { score: shared / new Set([...a, ...b]).size, shared };
}

function isBoilerplate(line) {
  return /^(?:sayın|sevgili|değerli)\s+(?:veli|veliler|velilerimiz)|^(?:saygılar|iyi çalışmalar)|^(?:sınıf öğretmeni|öğretmeniniz)\s*[,.:;-]*\s*$/iu.test(line);
}

function learningRows(message) {
  const titleLearning = hasAny(message.title, LEARNING_TERMS);
  const lines = splitLines(`${message.title ?? ""}\n${message.body ?? ""}`);
  let currentSubject = subjectFor(message.title);
  const rows = [];
  for (const line of lines) {
    const lineSubject = subjectFor(line);
    if (lineSubject) currentSubject = lineSubject;
    const lineLearning = hasAny(line, LEARNING_TERMS);
    if (hasAny(line, HOMEWORK_TERMS) && !lineLearning) continue;
    if (isBoilerplate(line) || (hasAny(line, ACTIVITY_TERMS) && !lineSubject && !lineLearning)) continue;
    if (!lineLearning && !(titleLearning && lineSubject)) continue;
    const withoutSignal = removeTerms(line, LEARNING_TERMS);
    const cleaned = stripSubjectPrefix(withoutSignal, lineSubject ?? currentSubject);
    if (cleaned.length < 3 || /^(?:bu\s+)?hafta[.!]?$/iu.test(cleaned)) continue;
    rows.push({ subject: lineSubject ?? currentSubject ?? "Genel", text: cleaned, messageId: message.id, sourceTitle: message.title });
  }
  return rows;
}

function taskRows(message) {
  const actionItems = message.analysis?.actionItems ?? [];
  if (actionItems.length) {
    return actionItems.map(task => ({
      messageId: message.id,
      taskKey: task.key,
      text: task.text,
      completed: Boolean(task.completed || task.status === "tamamlandı"),
      subject: subjectFor(task.text) ?? subjectFor(message.title) ?? subjectFor(message.body) ?? "Genel",
      sourceTitle: message.title,
      dates: message.analysis?.dates ?? []
    }));
  }
  const bodyRows = splitLines(message.body ?? "").filter(line => hasAny(line, HOMEWORK_TERMS));
  const candidates = bodyRows.length ? bodyRows : splitLines(message.title ?? "").filter(line => hasAny(line, HOMEWORK_TERMS));
  return candidates.map((line, index) => {
    const text = cleanLine(removeTerms(line, ["ödev", "hafta sonu"])).replace(/^[:\-–—]\s*/u, "") || cleanLine(line);
    return {
      messageId: message.id,
      taskKey: null,
      text,
      completed: false,
      subject: subjectFor(text) ?? subjectFor(message.title) ?? "Genel",
      sourceTitle: message.title,
      dates: message.analysis?.dates ?? [],
      inferredIndex: index
    };
  });
}

function activityRows(message) {
  const category = message.analysis?.category ?? "";
  if (!hasAny(`${category} ${message.title} ${message.body}`, ACTIVITY_TERMS)) return [];
  return [{ messageId: message.id, title: message.title, summary: message.analysis?.summary ?? message.body, dates: message.analysis?.dates ?? [], completed: false }];
}

function matchTask(task, learnings) {
  const candidates = learnings.filter(item => item.subject === task.subject || task.subject === "Genel" || item.subject === "Genel");
  let best = null;
  for (const learning of candidates) {
    const comparison = overlap(task.text, learning.text);
    if (!best || comparison.score > best.score) best = { learning, ...comparison };
  }
  const specificSubjects = best && task.subject !== "Genel" && best.learning.subject !== "Genel";
  if (best?.shared >= 2 && best.score >= 0.25 && specificSubjects) return { status: "eşleşti", confidence: "yüksek", score: best.score, learning: best.learning };
  if (best?.shared >= 1) return { status: "olası eşleşme", confidence: "düşük", score: best.score, learning: best.learning };
  return { status: "kontrol edilmeli", confidence: "belirsiz", score: 0, learning: null };
}

export function buildWeeklyLearningMap(messages, { anchor = new Date() } = {}) {
  const range = weekRange(anchor);
  const included = messages.filter(message => {
    const value = message.occurredAt || message.createdAt;
    if (!value) return false;
    try {
      const day = dayFromValue(value);
      return day >= range.from && day <= range.to;
    } catch {
      return false;
    }
  });
  const learnings = uniqueByText(included.flatMap(learningRows));
  const tasks = uniqueByText(included.flatMap(taskRows).map(task => ({ ...task, subject: task.subject ?? "Genel" })));
  const activities = included.flatMap(activityRows);
  const mappedTasks = tasks.map(task => ({ ...task, match: matchTask(task, learnings) }));
  const subjects = [...new Set([...learnings.map(item => item.subject), ...mappedTasks.map(item => item.subject)])]
    .sort((a, b) => a.localeCompare(b, "tr"))
    .map(subject => ({ subject, learnings: learnings.filter(item => item.subject === subject), tasks: mappedTasks.filter(item => item.subject === subject) }));
  const completed = mappedTasks.filter(task => task.completed).length;
  const matched = mappedTasks.filter(task => task.match.status === "eşleşti").length;
  return {
    range,
    label: `${range.from} – ${range.to}`,
    sourceMessageIds: [...new Set(included.map(message => message.id))],
    sourceCount: included.length,
    subjects,
    learnings,
    tasks: mappedTasks,
    activities,
    progress: { totalTasks: mappedTasks.length, completedTasks: completed, openTasks: mappedTasks.length - completed, matchedTasks: matched, needsReview: mappedTasks.length - matched },
    methodology: "Kazanımlar yalnızca okul iletilerindeki açık ifadelerden çıkarılır. Ödev-kazanım eşleştirmesi ortak anlamlı sözcüklere dayanır; genel, düşük güvenli ve eşleşmeyen maddeler kullanıcı kontrolüne bırakılır."
  };
}
