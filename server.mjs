import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { analyzeMessage } from "./lib/analyze.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
await mkdir(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "egitim-pusulasi.db"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'manual',
    external_id TEXT,
    kind TEXT NOT NULL DEFAULT 'message',
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    sender TEXT,
    occurred_at TEXT,
    source_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, external_id)
  );
  CREATE TABLE IF NOT EXISTS analyses (
    message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    action_items TEXT NOT NULL,
    dates TEXT NOT NULL,
    confidence REAL NOT NULL,
    provider TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body) });
  res.end(body);
}

async function bodyJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("İstek çok büyük");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function rowToMessage(row) {
  return {
    id: row.id,
    source: row.source,
    externalId: row.external_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    sender: row.sender,
    occurredAt: row.occurred_at,
    sourceUrl: row.source_url,
    createdAt: row.created_at,
    analysis: row.summary ? {
      summary: row.summary,
      category: row.category,
      priority: row.priority,
      actionItems: JSON.parse(row.action_items),
      dates: JSON.parse(row.dates),
      confidence: row.confidence,
      provider: row.provider,
      updatedAt: row.updated_at
    } : null
  };
}

const selectSql = `
  SELECT m.*, a.summary, a.category, a.priority, a.action_items, a.dates,
         a.confidence, a.provider, a.updated_at
  FROM messages m LEFT JOIN analyses a ON a.message_id = m.id
`;

function getMessage(id) {
  const row = db.prepare(`${selectSql} WHERE m.id = ?`).get(id);
  return row ? rowToMessage(row) : null;
}

async function runAnalysis(id) {
  const message = getMessage(id);
  if (!message) return null;
  const analysis = await analyzeMessage(message);
  db.prepare(`
    INSERT INTO analyses(message_id, summary, category, priority, action_items, dates, confidence, provider, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(message_id) DO UPDATE SET
      summary=excluded.summary, category=excluded.category, priority=excluded.priority,
      action_items=excluded.action_items, dates=excluded.dates, confidence=excluded.confidence,
      provider=excluded.provider, updated_at=CURRENT_TIMESTAMP
  `).run(id, analysis.summary, analysis.category, analysis.priority,
    JSON.stringify(analysis.actionItems), JSON.stringify(analysis.dates),
    analysis.confidence, analysis.provider);
  return getMessage(id);
}

async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, aiConfigured: Boolean(process.env.AI_API_URL && process.env.AI_API_KEY && process.env.AI_MODEL) });
  }
  if (req.method === "GET" && url.pathname === "/api/messages") {
    const query = url.searchParams.get("q")?.trim();
    const rows = query
      ? db.prepare(`${selectSql} WHERE m.title LIKE ? OR m.body LIKE ? ORDER BY COALESCE(m.occurred_at, m.created_at) DESC`).all(`%${query}%`, `%${query}%`)
      : db.prepare(`${selectSql} ORDER BY COALESCE(m.occurred_at, m.created_at) DESC`).all();
    return json(res, 200, rows.map(rowToMessage));
  }
  if (req.method === "POST" && url.pathname === "/api/messages") {
    const payload = await bodyJson(req);
    const items = Array.isArray(payload.items) ? payload.items : [payload];
    const insert = db.prepare(`INSERT OR IGNORE INTO messages(source, external_id, kind, title, body, sender, occurred_at, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const ids = [];
    for (const item of items.slice(0, 250)) {
      const title = String(item.title ?? "Başlıksız").trim().slice(0, 400);
      const body = String(item.body ?? "").trim().slice(0, 40_000);
      if (!body) continue;
      const result = insert.run(String(item.source ?? "manual"), item.externalId ? String(item.externalId) : null,
        String(item.kind ?? "message"), title, body, item.sender ? String(item.sender) : null,
        item.occurredAt ? String(item.occurredAt) : null, item.sourceUrl ? String(item.sourceUrl) : null);
      if (result.changes > 0) ids.push(Number(result.lastInsertRowid));
    }
    for (const id of ids) await runAnalysis(id);
    return json(res, 201, { imported: ids.length, items: ids.map(getMessage) });
  }
  const analyzeMatch = url.pathname.match(/^\/api\/messages\/(\d+)\/analyze$/);
  if (req.method === "POST" && analyzeMatch) {
    const message = await runAnalysis(Number(analyzeMatch[1]));
    return message ? json(res, 200, message) : json(res, 404, { error: "Mesaj bulunamadı" });
  }
  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    const counts = db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN a.priority='yüksek' THEN 1 ELSE 0 END) urgent FROM messages m LEFT JOIN analyses a ON a.message_id=m.id`).get();
    const categories = db.prepare(`SELECT COALESCE(a.category, 'İşlenmedi') category, COUNT(*) count FROM messages m LEFT JOIN analyses a ON a.message_id=m.id GROUP BY category ORDER BY count DESC`).all();
    const recent = db.prepare(`${selectSql} ORDER BY COALESCE(m.occurred_at, m.created_at) DESC LIMIT 5`).all().map(rowToMessage);
    return json(res, 200, { total: Number(counts.total ?? 0), urgent: Number(counts.urgent ?? 0), categories, recent });
  }
  return false;
}

const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname.startsWith("/api/")) {
      const handled = await api(req, res, url);
      if (handled !== false) return;
      return json(res, 404, { error: "API yolu bulunamadı" });
    }
    const relative = url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
    const file = path.resolve(ROOT, "public", relative);
    const publicRoot = path.resolve(ROOT, "public") + path.sep;
    if (!file.startsWith(publicRoot) || !existsSync(file)) return json(res, 404, { error: "Dosya bulunamadı" });
    const data = await readFile(file);
    res.writeHead(200, { "content-type": contentTypes[path.extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
server.listen(port, host, () => console.log(`Eğitim Pusulası: http://${host}:${port}`));

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
