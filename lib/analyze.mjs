const CATEGORY_RULES = [
  ["Sınav", /\b(sınav|quiz|yazılı|deneme)\b/i],
  ["Ödev", /\b(ödev|proje|teslim|çalışma kağıdı)\b/i],
  ["Etkinlik", /\b(etkinlik|gezi|tören|toplantı|kulüp)\b/i],
  ["Devamsızlık", /\b(devamsız|yoklama|geç kaldı|gecikme)\b/i],
  ["Ödeme", /\b(ödeme|ücret|aidat|tutar|tl)\b/i],
  ["Malzeme", /\b(malzeme|yanında getirsin|getiriniz|çantasında)\b/i]
];

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
  for (const match of text.matchAll(/\b(?:bugün|yarın|pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)\b/gi)) {
    results.add(match[0]);
  }
  return [...results].slice(0, 8).map(value => ({ value, certainty: "metinde_geçiyor" }));
}

function extractActions(text) {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(value => value.trim())
    .filter(Boolean)
    .filter(value => /\b(getir|teslim|hazırla|oku|çalış|imzala|öde|katıl|unutma|gerekmektedir|bekliyoruz)\w*/i.test(value))
    .slice(0, 6)
    .map(value => ({ text: value, status: "açık" }));
}

export function analyzeLocally(message) {
  const text = `${message.title ?? ""}\n${message.body ?? ""}`;
  const category = CATEGORY_RULES.find(([, rule]) => rule.test(text))?.[0] ?? "Duyuru";
  const priority = /\b(acil|son gün|bugün|yarın|önemli|zorunlu)\b/i.test(text) ? "yüksek" : "normal";
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

export async function analyzeMessage(message) {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!apiUrl || !apiKey || !model) return analyzeLocally(message);

  const prompt = `Sen ebeveyn kontrollü bir eğitim takip asistanısın. Aşağıdaki okul mesajını yorumla. Yalnızca mesajda bulunan olguları kullan; tahmin etme. JSON dışında hiçbir şey döndürme. Şema: {"summary":"kısa Türkçe özet","category":"Duyuru|Ödev|Sınav|Etkinlik|Devamsızlık|Ödeme|Malzeme|Diğer","priority":"düşük|normal|yüksek","actionItems":[{"text":"yapılacak iş","status":"açık"}],"dates":[{"value":"metindeki ifade","certainty":"kesin|metinde_geçiyor"}],"confidence":0.0}.\n\nBaşlık: ${message.title ?? ""}\nGönderen: ${message.sender ?? ""}\nTarih: ${message.occurredAt ?? ""}\nMesaj:\n${message.body ?? ""}`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, input: prompt })
  });
  if (!response.ok) throw new Error(`AI servisi ${response.status} döndürdü`);
  const data = await response.json();
  const output = data.output_text ?? data.output?.flatMap(item => item.content ?? []).find(item => item.type === "output_text")?.text;
  if (!output) throw new Error("AI yanıtında metin bulunamadı");
  return parseAiJson(output);
}
