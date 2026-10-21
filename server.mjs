import http from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { analyzeMessage, cloudAiPreview, isCloudAiConfigured } from "./lib/analyze.mjs";
import { ConnectorValidationError, connectorDescriptors, normalizeConnectorItems } from "./lib/connectors/contract.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
await mkdir(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, "egitim-pusulasi.db"));
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
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

const messageColumns = db.prepare("PRAGMA table_info(messages)").all();
if (!messageColumns.some(column => column.name === "profile_id")) {
  db.exec("ALTER TABLE messages ADD COLUMN profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE");
}
db.prepare(`INSERT INTO profiles(name, is_default) SELECT ?, 1 WHERE NOT EXISTS (SELECT 1 FROM profiles)`).run("Çocuğum");
const defaultProfileId = Number(db.prepare("SELECT id FROM profiles ORDER BY is_default DESC, id ASC LIMIT 1").get().id);
db.prepare("UPDATE messages SET profile_id = ? WHERE profile_id IS NULL").run(defaultProfileId);
db.prepare(`UPDATE messages SET external_id = CAST(profile_id AS TEXT) || ':' || external_id WHERE external_id IS NOT NULL AND external_id NOT LIKE CAST(profile_id AS TEXT) || ':%'`).run();

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer"
  });
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
  const storedPrefix = `${row.profile_id}:`;
  return {
    id: row.id,
    profileId: row.profile_id,
    profileName: row.profile_name,
    source: row.source,
    externalId: row.external_id?.startsWith(storedPrefix) ? row.external_id.slice(storedPrefix.length) : row.external_id,
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
         a.confidence, a.provider, a.updated_at, p.name AS profile_name
  FROM messages m
  JOIN profiles p ON p.id = m.profile_id
  LEFT JOIN analyses a ON a.message_id = m.id
`;

function getMessage(id) {
  const row = db.prepare(`${selectSql} WHERE m.id = ?`).get(id);
  return row ? rowToMessage(row) : null;
}

async function runAnalysis(id, mode = "local") {
  const message = getMessage(id);
  if (!message) return null;
  const analysis = await analyzeMessage(message, { mode });
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

function resolveProfileId(value) {
  const profileId = value == null || value === "" ? defaultProfileId : Number(value);
  if (!Number.isInteger(profileId) || profileId < 1) throw new ProfileValidationError("Geçersiz çocuk profili");
  if (!db.prepare("SELECT 1 FROM profiles WHERE id = ?").get(profileId)) throw new ProfileValidationError("Çocuk profili bulunamadı");
  return profileId;
}

class ProfileValidationError extends Error {}

async function importItems(items, fallbackProfileId = defaultProfileId) {
  const insert = db.prepare(`INSERT OR IGNORE INTO messages(profile_id, source, external_id, kind, title, body, sender, occurred_at, source_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const ids = [];
  for (const item of items.slice(0, 250)) {
    const profileId = resolveProfileId(item.profileId ?? fallbackProfileId);
    const title = String(item.title ?? "Başlıksız").trim().slice(0, 400);
    const body = String(item.body ?? "").trim().slice(0, 40_000);
    if (!body) continue;
    const storedExternalId = item.externalId ? `${profileId}:${String(item.externalId)}` : null;
    const result = insert.run(profileId, String(item.source ?? "manual"), storedExternalId,
      String(item.kind ?? "message"), title, body, item.sender ? String(item.sender) : null,
      item.occurredAt ? String(item.occurredAt) : null, item.sourceUrl ? String(item.sourceUrl) : null);
    if (result.changes > 0) ids.push(Number(result.lastInsertRowid));
  }
  for (const id of ids) await runAnalysis(id);
  return ids;
}

async function api(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true, aiConfigured: isCloudAiConfigured(), cloudRequiresPerMessageConsent: true });
  }
  if (req.method === "GET" && url.pathname === "/api/messages") {
    const query = url.searchParams.get("q")?.trim();
    const profileId = url.searchParams.has("profileId") ? resolveProfileId(url.searchParams.get("profileId")) : null;
    const clauses = [];
    const parameters = [];
    if (profileId) { clauses.push("m.profile_id = ?"); parameters.push(profileId); }
    if (query) { clauses.push("(m.title LIKE ? OR m.body LIKE ?)"); parameters.push(`%${query}%`, `%${query}%`); }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.prepare(`${selectSql}${where} ORDER BY COALESCE(m.occurred_at, m.created_at) DESC`).all(...parameters);
    return json(res, 200, rows.map(rowToMessage));
  }
  if (req.method === "GET" && url.pathname === "/api/profiles") {
    return json(res, 200, db.prepare("SELECT id, name, is_default AS isDefault, created_at AS createdAt FROM profiles ORDER BY is_default DESC, id ASC").all());
  }
  if (req.method === "POST" && url.pathname === "/api/profiles") {
    const payload = await bodyJson(req);
    const name = String(payload.name ?? "").trim().slice(0, 80);
    if (!name) return json(res, 400, { error: "Profil adı boş olamaz" });
    const result = db.prepare("INSERT INTO profiles(name, is_default) VALUES (?, 0)").run(name);
    const profile = db.prepare("SELECT id, name, is_default AS isDefault, created_at AS createdAt FROM profiles WHERE id = ?").get(result.lastInsertRowid);
    return json(res, 201, profile);
  }
  if (req.method === "GET" && url.pathname === "/api/connectors") {
    return json(res, 200, connectorDescriptors);
  }
  if (req.method === "GET" && url.pathname === "/api/export") {
    const items = db.prepare(`${selectSql} ORDER BY COALESCE(m.occurred_at, m.created_at) DESC`).all().map(rowToMessage);
    return json(res, 200, {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      product: "Eğitim Pusulası",
      profiles: db.prepare("SELECT id, name, is_default AS isDefault, created_at AS createdAt FROM profiles ORDER BY id").all(),
      items
    });
  }
  if (req.method === "POST" && url.pathname === "/api/messages") {
    const payload = await bodyJson(req);
    const items = Array.isArray(payload.items) ? payload.items : [payload];
    const ids = await importItems(items);
    return json(res, 201, { imported: ids.length, items: ids.map(getMessage) });
  }
  const connectorImportMatch = url.pathname.match(/^\/api\/connectors\/([a-z0-9-]+)\/import$/);
  if (req.method === "POST" && connectorImportMatch) {
    try {
      const payload = await bodyJson(req);
      const items = normalizeConnectorItems(connectorImportMatch[1], payload.records);
      const profileId = resolveProfileId(payload.profileId);
      const ids = await importItems(items, profileId);
      return json(res, 201, { connector: connectorImportMatch[1], imported: ids.length, items: ids.map(getMessage) });
    } catch (error) {
      if (error instanceof ConnectorValidationError) return json(res, 400, { error: error.message });
      throw error;
    }
  }
  const analyzeMatch = url.pathname.match(/^\/api\/messages\/(\d+)\/analyze$/);
  if (req.method === "POST" && analyzeMatch) {
    const payload = await bodyJson(req);
    const mode = payload.mode === "cloud" ? "cloud" : "local";
    const message = await runAnalysis(Number(analyzeMatch[1]), mode);
    return message ? json(res, 200, message) : json(res, 404, { error: "Mesaj bulunamadı" });
  }
  const previewMatch = url.pathname.match(/^\/api\/messages\/(\d+)\/ai-preview$/);
  if (req.method === "GET" && previewMatch) {
    const message = getMessage(Number(previewMatch[1]));
    if (!message) return json(res, 404, { error: "Mesaj bulunamadı" });
    if (!isCloudAiConfigured()) return json(res, 409, { error: "Bulut AI servisi yapılandırılmamış" });
    const preview = cloudAiPreview(message);
    return json(res, 200, {
      providerConfigured: true,
      redactionEnabled: preview.redactionEnabled,
      fields: preview.fields,
      characters: preview.characters
    });
  }
  const deleteMatch = url.pathname.match(/^\/api\/messages\/(\d+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const id = Number(deleteMatch[1]);
    const result = db.prepare("DELETE FROM messages WHERE id = ?").run(id);
    return result.changes > 0 ? json(res, 200, { deleted: 1 }) : json(res, 404, { error: "Mesaj bulunamadı" });
  }
  if (req.method === "DELETE" && url.pathname === "/api/messages") {
    const profileId = url.searchParams.has("profileId") ? resolveProfileId(url.searchParams.get("profileId")) : null;
    const result = profileId
      ? db.prepare("DELETE FROM messages WHERE profile_id = ?").run(profileId)
      : db.prepare("DELETE FROM messages").run();
    return json(res, 200, { deleted: Number(result.changes) });
  }
  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    const profileId = url.searchParams.has("profileId") ? resolveProfileId(url.searchParams.get("profileId")) : null;
    const profileWhere = profileId ? " WHERE m.profile_id = ?" : "";
    const args = profileId ? [profileId] : [];
    const counts = db.prepare(`SELECT COUNT(*) total, SUM(CASE WHEN a.priority='yüksek' THEN 1 ELSE 0 END) urgent FROM messages m LEFT JOIN analyses a ON a.message_id=m.id${profileWhere}`).get(...args);
    const categories = db.prepare(`SELECT COALESCE(a.category, 'İşlenmedi') category, COUNT(*) count FROM messages m LEFT JOIN analyses a ON a.message_id=m.id${profileWhere} GROUP BY category ORDER BY count DESC`).all(...args);
    const recent = db.prepare(`${selectSql}${profileWhere} ORDER BY COALESCE(m.occurred_at, m.created_at) DESC LIMIT 5`).all(...args).map(rowToMessage);
    return json(res, 200, { total: Number(counts.total ?? 0), urgent: Number(counts.urgent ?? 0), categories, recent });
  }
  return false;
}

const contentTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const allowedAuthorities = new Set([`${host}:${port}`, `127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]);
const allowedOrigins = new Set([...allowedAuthorities].map(value => `http://${value}`));

const server = http.createServer(async (req, res) => {
  try {
    const authority = req.headers.host;
    if (!authority || !allowedAuthorities.has(authority.toLowerCase())) {
      return json(res, 403, { error: "Geçersiz Host başlığı" });
    }
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin.toLowerCase())) {
      return json(res, 403, { error: "Bu kaynaktan isteğe izin verilmiyor" });
    }
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
    res.writeHead(200, {
      "content-type": contentTypes[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    });
    res.end(data);
  } catch (error) {
    if (error instanceof ProfileValidationError) return json(res, 400, { error: error.message });
    json(res, 500, { error: error.message });
  }
});

server.listen(port, host, () => console.log(`Eğitim Pusulası: http://${host}:${port}`));

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
