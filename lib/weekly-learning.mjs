export class WeeklyLearningValidationError extends Error {}

const SUBJECTS = [
  ["Türkçe", /\b(?:türkçe|okuma|yazma|dil bilgisi)\b/iu],
  ["Matematik", /\b(?:matematik|geometri)\b/iu],
  ["Fen Bilimleri", /\b(?:fen(?: bilimleri)?|bilim)\b/iu],
  ["Sosyal Bilgiler", /\b(?:sosyal bilgiler|sosyal)\b/iu],
  ["İngilizce", /\b(?:ingilizce|english)\b/iu],
  ["Hayat Bilgisi", /\b(?:hayat bilgisi)\b/iu],
  ["Din Kültürü", /\b(?:din kültürü|din dersi)\b/iu],
  ["Bilişim", /\b(?:bilişim|kodlama|teknoloji)\b/iu],
  ["Görsel Sanatlar", /\b(?:görsel sanatlar|resim)\b/iu],
  ["Müzik", /\b(?:müzik)\b/iu],
  ["Beden Eğitimi", /\b(?:beden eğitimi|spor)\b/iu],
  ["Rehberlik", /\b(?:rehberlik)\b/iu]
];

const LEARNING_SIGNAL = /\b(?:kazanım(?:lar)?|işlenen konular?|öğren(?:dik|ilecek|me)|dersimizde|çalıştık|işledik|konu(?:lar)?)\b/iu;
const HOMEWORK_SIGNAL = /\b(?:ödev|hafta sonu|çalışma kağıdı|çalışma kâğıdı|sayfa|soru|test|okuyunuz|yapınız|tamamlayınız|çözünüz|hazırlayınız|tekrar)\b/iu;
const ACTIVITY_SIGNAL = /\b(?:etkinlik|gezi|toplantı|kulüp|gösteri|turnuva|proje|sunum|atölye)\b/iu;
const STOP_WORDS = new Set("ve veya ile için bir bu şu o da de mı mi mu mü hafta haftalık sonu ders dersinde konusu konular kazanım kazanımlar ödev çalışma yapılacak yapınız ediniz olan olarak öğrenci öğrenciler".split(" "));

function parseDate(value) {
  const text = String(value ?? "").trim();
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text) ? `${text.replace(" ", "T")}Z` : text);
  if (Number.isNaN(date.getTime())) throw new WeeklyLearningValidationError("Hafta tarihi geçerli olmalıdır");
  return date;
}

function isoDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayFromValue(value) {
  const explicit = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  return explicit?.[1] ?? isoDay(parseDate(value));
}

function weekRange(anchor) {
  const date = parseDate(anchor);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { from: isoDay(start), to: isoDay(end) };
}

function cleanLine(value) {
  return String(value ?? "")
    .replace(/^[\s•●▪◦*\-–—\d.)]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
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
  const text = String(value ?? "");
  return SUBJECTS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function stripSubjectPrefix(line, subject) {
  if (!subject) return line;
  return cleanLine(line.replace(new RegExp(`^${subject.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[:\\-–—]?\\s*`, "iu"), ""));
}

function uniqueByText(rows) {
  const seen = new Set();
  return rows.filter(row => {
    const key = `${row.subject}\0${row.text.toLocaleLowerCase("tr-TR")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tokens(value) {
  return new Set(String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9çğıöşü\s]/giu, " ")
    .split(/\s+/)
    .filter(token => token.length >= 3 && !STOP_WORDS.has(token)));
}

function overlap(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) {
    if ([...b].some(other => token === other || (token.length >= 5 && other.length >= 5 && token.slice(0, 5) === other.slice(0, 5)))) shared += 1;
  }
  return shared / Math.min(a.size, b.size);
}

function learningRows(message) {
  const text = `${message.title ?? ""}\n${message.body ?? ""}`;
  const lines = splitLines(text);
  const weeklyLearningMessage = LEARNING_SIGNAL.test(text);
  let currentSubject = subjectFor(message.title);
  const rows = [];
  for (const line of lines) {
    const lineSubject = subjectFor(line);
    if (lineSubject) currentSubject = lineSubject;
    if (HOMEWORK_SIGNAL.test(line) && !LEARNING_SIGNAL.test(line)) continue;
    if (!weeklyLearningMessage && !LEARNING_SIGNAL.test(line)) continue;
    const cleaned = stripSubjectPrefix(line.replace(LEARNING_SIGNAL, ""), lineSubject ?? currentSubject);
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
  return splitLines(`${message.title ?? ""}\n${message.body ?? ""}`)
    .filter(line => HOMEWORK_SIGNAL.test(line))
    .map((text, index) => ({
      messageId: message.id,
      taskKey: null,
      text,
      completed: false,
      subject: subjectFor(text) ?? subjectFor(message.title) ?? "Genel",
      sourceTitle: message.title,
      dates: message.analysis?.dates ?? [],
      inferredIndex: index
    }));
}

function activityRows(message) {
  const category = message.analysis?.category ?? "";
  if (!ACTIVITY_SIGNAL.test(`${category} ${message.title} ${message.body}`)) return [];
  return [{
    messageId: message.id,
    title: message.title,
    summary: message.analysis?.summary ?? message.body,
    dates: message.analysis?.dates ?? [],
    completed: false
  }];
}

function matchTask(task, learnings) {
  const candidates = learnings.filter(item => item.subject === task.subject || task.subject === "Genel" || item.subject === "Genel");
  let best = null;
  for (const learning of candidates) {
    const score = overlap(task.text, learning.text);
    if (!best || score > best.score) best = { learning, score };
  }
  if (best?.score >= 0.3) return { status: "eşleşti", confidence: "yüksek", score: best.score, learning: best.learning };
  if (best?.score > 0) return { status: "olası eşleşme", confidence: "düşük", score: best.score, learning: best.learning };
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
    .map(subject => ({
      subject,
      learnings: learnings.filter(item => item.subject === subject),
      tasks: mappedTasks.filter(item => item.subject === subject)
    }));
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
    progress: {
      totalTasks: mappedTasks.length,
      completedTasks: completed,
      openTasks: mappedTasks.length - completed,
      matchedTasks: matched,
      needsReview: mappedTasks.length - matched
    },
    methodology: "Kazanımlar yalnızca okul iletilerindeki açık ifadelerden çıkarılır. Ödev-kazanım eşleştirmesi sözcük örtüşmesine dayanır; düşük güvenli ve eşleşmeyen maddeler kullanıcı kontrolüne bırakılır."
  };
}
