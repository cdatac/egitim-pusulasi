import { aiProviderName, aiRequestHeaders, inspectAiConfiguration } from "./ai-config.mjs";

function rootRule(...roots) {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_])(?:${roots.join("|")})[\\p{L}\\p{N}_]*(?=$|[^\\p{L}\\p{N}_])`, "iu");
}

const CATEGORY_RULES = [
  ["Sınav", rootRule("sınav", "quiz", "yazılı", "deneme")],
  ["Ödev", rootRule("ödev", "proje", "teslim", "çalışma kağıdı")],
  ["Etkinlik", rootRule("etkinlik", "gezi", "tören", "toplantı", "kulüp")],
  ["Devamsızlık", rootRule("devamsız", "yoklama", "geç kaldı", "gecik")],
  ["Ödeme", rootRule("ödeme", "ücret", "aidat", "tutar", "tl")],
  ["Malzeme", rootRule("malzeme", "yanında getirsin", "getiriniz", "çanta")]
];

const DATE_WORD_RULE = /(?<![\p{L}\p{N}_])(?:bugün|yarın|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)(?![\p{L}\p{N}_])/giu;
const ACTION_RULE = rootRule("getir", "teslim", "hazırla", "oku", "çalış", "imzala", "öde(?!v)", "katıl", "unutma", "gerekmektedir", "bekliyoruz");
const PRIORITY_RULE = rootRule("acil", "son gün", "bugün", "yarın", "önemli", "zorunlu");

function firstSentence(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentence = clean.match(/^.{1,220}?(?:[.!?](?:\s|$)|$)/)?.[0] ?? clean.slice(0, 220);
  return sentence.trim();
}

function extractDates(text) {
  const results = new Set();
  for (const match of text.matchAll(/\b(?:0?[1-9]|[12]\d|3[01])[./-](?:0?[1-9]|1[0-2])(?:[./-](?:20)?\d{2})?\b/g)) {
    results.add(match[0]);
  }
  for (const match of text.matchAll(DATE_WORD_RULE)) {
    results.add(match[0]);
  }
  return [...results].slice(0, 8).map(value => ({ value, certainty: "metinde_geçiyor" }));
}

function extractActions(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(value => value.trim())
    .filter(Boolean)
    .filter(value => ACTION_RULE.test(value))
    .slice(0, 6)
    .map(value => ({ text: value, status: "açık" }));
}

export function analyzeLocally(message) {
  const text = `${message.title ?? ""}\n${message.body ?? ""}`;
  const category = CATEGORY_RULES.find(([, rule]) => rule.test(text))?.[0] ?? "Duyuru";
  const priority = PRIORITY_RULE.test(text) ? "yüksek" : "normal";
  return {
    summary: firstSentence(message.body || message.title || "İçerik yok"),
    category,
    priority,
    actionItems: extractActions(text),
    dates: extractDates(text),
    confidence: 0.55,
    provider: "yerel-kural"
  };
}

function parseAiJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  const result = JSON.parse(cleaned);
  return {
    summary: String(result.summary ?? "").slice(0, 1200),
    category: String(result.category ?? "Duyuru").slice(0, 80),
    priority: ["düşük", "normal", "yüksek"].includes(result.priority) ? result.priority : "normal",
    actionItems: Array.isArray(result.actionItems) ? result.actionItems.slice(0, 10) : [],
    dates: Array.isArray(result.dates) ? result.dates.slice(0, 10) : [],
    confidence: Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : 0.7,
    provider: "yapay-zeka"
  };
}

export function isAiConfigured() {
  return inspectAiConfiguration().configured;
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactSensitiveText(value, redactTerms = []) {
  let result = String(value ?? "");
  const terms = [...new Set(redactTerms.map(term => String(term).trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const term of terms) result = result.replace(new RegExp(escapePattern(term), "giu"), "[ÖZEL İFADE MASKELENDİ]");
  return result
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[E-POSTA MASKELENDİ]")
    .replace(/(?<!\d)(?:\+?90\s*)?0?5\d{2}[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}(?!\d)/g, "[TELEFON MASKELENDİ]");
}

export function cloudAiPreview(message, { redactTerms = [] } = {}) {
  const redactionEnabled = process.env.AI_REDACT !== "false";
  const fields = {
    title: message.title ?? "",
    sender: message.sender ?? "",
    occurredAt: message.occurredAt ?? "",
    body: message.body ?? ""
  };
  const prepared = redactionEnabled
    ? Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, redactSensitiveText(value, redactTerms)]))
    : fields;
  return {
    redactionEnabled,
    customRedactionTerms: redactionEnabled ? redactTerms.length : 0,
    fields: Object.keys(prepared),
    characters: Object.values(prepared).reduce((sum, value) => sum + String(value).length, 0),
    prepared
  };
}

export async function analyzeMessage(message, { mode = "local", redactTerms = [] } = {}) {
  if (mode !== "cloud") return analyzeLocally(message);
  const configuration = inspectAiConfiguration();
  if (!configuration.configured) throw new Error("AI servisi yapılandırılmamış");

  const preview = cloudAiPreview(message, { redactTerms });
  const prepared = preview.prepared;

  const prompt = `Sen ebeveyn kontrollü bir eğitim takip asistanısın. Aşağıdaki okul mesajını yorumla. Yalnızca mesajda bulunan olguları kullan; tahmin etme. JSON dışında hiçbir şey döndürme. Şema: {"summary":"kısa Türkçe özet","category":"Duyuru|Ödev|Sınav|Etkinlik|Devamsızlık|Ödeme|Malzeme|Diğer","priority":"düşük|normal|yüksek","actionItems":[{"text":"yapılacak iş","status":"açık"}],"dates":[{"value":"metindeki ifade","certainty":"kesin|metinde_geçiyor"}],"confidence":0.0}.\n\nBaşlık: ${prepared.title}\nGönderen: ${prepared.sender}\nTarih: ${prepared.occurredAt}\nMesaj:\n${prepared.body}`;
  const response = await fetch(configuration.apiUrl, {
    method: "POST",
    headers: aiRequestHeaders(configuration),
    body: JSON.stringify({ model: configuration.model, input: prompt })
  });
  if (!response.ok) throw new Error(`AI servisi ${response.status} döndürdü`);
  const data = await response.json();
  const output = data.output_text ?? data.output?.flatMap(item => item.content ?? []).find(item => item.type === "output_text")?.text;
  if (!output) throw new Error("AI yanıtında metin bulunamadı");
  const result = parseAiJson(output);
  result.provider = aiProviderName(configuration, preview.redactionEnabled);
  return result;
}
