const DEFAULT_CDP_ENDPOINT = "http://127.0.0.1:9222";
const API_PREFIX = "/SPCore.Web/api/";
const MESSAGE_PAGE = "/SPTS.Web/WebParts/Message/";
const MAX_RECORDS = 250;
const COMMAND_TIMEOUT_MS = 10_000;
const TOTAL_TIMEOUT_MS = 60_000;
const DETAIL_BUDGET_MS = 40_000;

export class K12ConnectorError extends Error {
  constructor(message, code = "k12_connector_error") {
    super(message);
    this.name = "K12ConnectorError";
    this.code = code;
  }
}

function isAllowedK12Url(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "k12net.com" || url.hostname.endsWith(".k12net.com"));
  } catch {
    return false;
  }
}

function isAllowedDebuggerUrl(value, endpoint) {
  try {
    const debuggerUrl = new URL(value);
    const endpointUrl = new URL(endpoint);
    return debuggerUrl.protocol === "ws:" && debuggerUrl.hostname === "127.0.0.1" && debuggerUrl.port === endpointUrl.port;
  } catch {
    return false;
  }
}

async function fetchJson(url, { fetchImpl = fetch, timeoutMs = 2_500 } = {}) {
  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new K12ConnectorError("K12 için açılan Chrome bulunamadı. Önce K12 bağlantı penceresini açıp giriş yapın.", "cdp_unavailable");
  }
  if (!response.ok) throw new K12ConnectorError("Chrome bağlantısı yanıt vermedi.", "cdp_unavailable");
  return response.json();
}

export async function inspectK12Browser({ endpoint = DEFAULT_CDP_ENDPOINT, fetchImpl = fetch } = {}) {
  const targets = await fetchJson(`${endpoint}/json/list`, { fetchImpl });
  const pages = Array.isArray(targets) ? targets.filter(target => target.type === "page" && isAllowedK12Url(target.url) && isAllowedDebuggerUrl(target.webSocketDebuggerUrl, endpoint)) : [];
  const target = pages[0];
  return {
    available: Boolean(target),
    loggedIn: Boolean(target && new URL(target.url).pathname.toLocaleLowerCase("tr-TR").includes("spts.web")),
    origin: target ? new URL(target.url).origin : null,
    targetId: target?.id ?? null,
    target: target ? {
      id: target.id,
      url: target.url,
      webSocketDebuggerUrl: target.webSocketDebuggerUrl
    } : null
  };
}

class CdpClient {
  constructor(url, WebSocketImpl = WebSocket) {
    this.socket = new WebSocketImpl(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.closed = false;
  }

  rejectAll(error) {
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(error);
    }
    this.pending.clear();
  }

  async open(timeoutMs = 5_000) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new K12ConnectorError("Chrome denetim bağlantısı zaman aşımına uğradı.", "cdp_timeout")), timeoutMs);
      this.socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      this.socket.addEventListener("error", () => { clearTimeout(timer); reject(new K12ConnectorError("Chrome denetim bağlantısı kurulamadı.", "cdp_unavailable")); }, { once: true });
    });
    this.socket.addEventListener("message", event => {
      let message;
      try { message = JSON.parse(String(event.data)); } catch { return; }
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject, timer } = this.pending.get(message.id);
        this.pending.delete(message.id);
        clearTimeout(timer);
        if (message.error) reject(new K12ConnectorError(message.error.message || "Chrome komutu başarısız oldu.", "cdp_command_failed"));
        else resolve(message.result ?? {});
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
    const disconnected = () => {
      if (this.closed) return;
      this.closed = true;
      this.rejectAll(new K12ConnectorError("Chrome denetim bağlantısı kapandı.", "cdp_disconnected"));
    };
    this.socket.addEventListener("close", disconnected);
    this.socket.addEventListener("error", disconnected);
  }

  send(method, params = {}, timeoutMs = COMMAND_TIMEOUT_MS) {
    if (this.closed) return Promise.reject(new K12ConnectorError("Chrome denetim bağlantısı kapalı.", "cdp_disconnected"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new K12ConnectorError(`Chrome komutu zaman aşımına uğradı: ${method}`, "cdp_timeout"));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.socket.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new K12ConnectorError(`Chrome komutu gönderilemedi: ${error.message}`, "cdp_disconnected"));
      }
    });
  }

  onEvent(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close() {
    this.closed = true;
    this.rejectAll(new K12ConnectorError("Chrome denetim bağlantısı kapatıldı.", "cdp_disconnected"));
    try { this.socket.close(); } catch { /* already closed */ }
  }
}

function responseRootResults(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value.RootResults)) return value.RootResults;
  if (Array.isArray(value.rootResults)) return value.rootResults;
  if (value.d) return responseRootResults(value.d);
  return [];
}

function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function nestedName(value) {
  if (!value || typeof value !== "object") return null;
  return firstText(value.FullName, value.fullName, value.DisplayName, value.displayName, value.Name?.FullName, value.Name?.fullName, value.Name);
}

function cleanHtml(value) {
  if (!value) return null;
  return String(value)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function messageTypeName(row) {
  return firstText(row?.Type?.Code, row?.Type?.Name, row?.TypeName, row?.MessageTypeName, row?.Kind) ?? "";
}

function normalizeK12Date(value) {
  const text = firstText(value);
  if (!text) return null;
  const dotNet = text.match(/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/);
  if (!dotNet) return text;
  const timestamp = Number(dotNet[1]);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : text;
}

export function normalizeK12Messages(listPayloads, detailPayloads = [], origin = "https://okul.k12net.com") {
  const details = new Map();
  for (const payload of detailPayloads) {
    for (const row of responseRootResults(payload)) {
      const id = firstText(row.ID, row.Id, row.id);
      if (id) details.set(canonicalMessageId(id), row);
    }
  }

  const records = [];
  const seen = new Set();
  for (const payload of listPayloads) {
    for (const summary of responseRootResults(payload)) {
      const id = firstText(summary.ID, summary.Id, summary.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const detail = details.get(canonicalMessageId(id));
      const row = { ...summary, ...(detail ?? {}) };
      const title = firstText(row.Subject, row.Title, row.Header, row.Name) ?? "K12 iletisi";
      const body = cleanHtml(firstText(row.Body, row.Content, row.Message, row.Description, row.Explanation)) ?? title;
      const type = messageTypeName(row).toLocaleLowerCase("tr-TR");
      const isAnnouncement = type.includes("announcement") || type.includes("duyuru") || type.includes("notice");
      const sender = firstText(row.SenderName, row.FromName, row.CreatedByName, nestedName(row.Sender), nestedName(row.CreatedBy));
      const occurredAt = normalizeK12Date(firstText(row.SendDate, row.SentDate, row.Date, row.CreateDate, row.CreatedAt, row.StartDate));
      records.push({
        externalId: id,
        kind: isAnnouncement ? "announcement" : "message",
        title,
        body,
        sender,
        occurredAt,
        sourceUrl: `${origin}${MESSAGE_PAGE}#/`,
        bodyComplete: Boolean(detail)
      });
      if (records.length >= MAX_RECORDS) return records;
    }
  }
  return records;
}

function safeMessageId(value) {
  return typeof value === "string" && /^[{}0-9a-f-]{32,40}$/i.test(value) ? value : null;
}

function canonicalMessageId(value) {
  return String(value ?? "").replace(/[{}]/g, "").toLocaleLowerCase("en-US");
}

function enrollmentIdFromInboxUrl(value) {
  try {
    const match = new URL(value).pathname.match(/\/Messages\/([^/]+)\/Inbox$/i);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function allowedApiResponse(url, origin) {
  try {
    const parsed = new URL(url);
    return parsed.origin === origin && parsed.pathname.startsWith(API_PREFIX) && parsed.pathname.includes("/Messages/");
  } catch {
    return false;
  }
}

function decodeResponseBody(result) {
  const text = result.base64Encoded ? Buffer.from(result.body, "base64").toString("utf8") : result.body;
  if (!text || text.length > 5_000_000) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function pickRequestHeaders(headers = {}) {
  const allowed = new Set(["appid", "happid", "harid"]);
  return Object.fromEntries(Object.entries(headers).filter(([name, value]) => allowed.has(name.toLocaleLowerCase("en-US")) && typeof value === "string"));
}

async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function syncK12MessagesInternal({
  endpoint,
  fetchImpl,
  WebSocketImpl,
  knownExternalIds,
  expectedEnrollmentId,
  disallowedEnrollmentIds,
  allowEnrollmentBinding,
  detailBudgetMs,
  onClient,
  isAborted
}) {
  const browser = await inspectK12Browser({ endpoint, fetchImpl });
  if (isAborted()) throw new K12ConnectorError("K12 eşitlemesi iptal edildi.", "k12_sync_timeout");
  if (!browser.available) throw new K12ConnectorError("Açık bir K12 Chrome sekmesi bulunamadı.", "k12_target_missing");
  if (!browser.loggedIn) throw new K12ConnectorError("K12 sekmesi bulundu ancak veli ekranına giriş yapılmamış görünüyor.", "k12_login_required");

  const client = new CdpClient(browser.target.webSocketDebuggerUrl, WebSocketImpl);
  onClient(client);
  const requests = new Map();
  const responses = new Map();
  const finished = new Set();
  let resolveInboxFinished;
  const inboxFinished = new Promise(resolve => { resolveInboxFinished = resolve; });
  let inboxHeaders = {};
  const removeListener = client.onEvent(message => {
    if (message.method === "Network.requestWillBeSent") {
      const request = message.params?.request;
      if (request && allowedApiResponse(request.url, browser.origin)) {
        requests.set(message.params.requestId, { url: request.url, method: request.method, headers: request.headers ?? {} });
        if (new URL(request.url).pathname.endsWith("/Inbox")) inboxHeaders = pickRequestHeaders(request.headers);
      }
    }
    if (message.method === "Network.responseReceived" && requests.has(message.params?.requestId)) {
      responses.set(message.params.requestId, message.params.response);
    }
    if (message.method === "Network.loadingFinished") {
      const requestId = message.params?.requestId;
      finished.add(requestId);
      const request = requests.get(requestId);
      if (request && new URL(request.url).pathname.endsWith("/Inbox")) resolveInboxFinished();
    }
  });

  try {
    await client.open();
    if (isAborted()) throw new K12ConnectorError("K12 eşitlemesi iptal edildi.", "k12_sync_timeout");
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable", { maxTotalBufferSize: 10_000_000, maxResourceBufferSize: 5_000_000 });
    await client.send("Page.navigate", { url: `${browser.origin}${MESSAGE_PAGE}` });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new K12ConnectorError("K12 gelen kutusu zamanında yüklenmedi.", "k12_inbox_timeout")), 15_000);
      inboxFinished.then(() => { clearTimeout(timer); resolve(); });
    });
    await wait(200);

    const payloads = [];
    for (const [requestId, response] of responses) {
      if (!finished.has(requestId) || response.status < 200 || response.status >= 300) continue;
      try {
        const body = decodeResponseBody(await client.send("Network.getResponseBody", { requestId }));
        if (body) payloads.push({ request: requests.get(requestId), body });
      } catch { /* a response can leave the browser cache before it is read */ }
    }

    const inboxPayloads = payloads
      .filter(item => new URL(item.request.url).pathname.endsWith("/Inbox"))
      .map(item => item.body);
    const inboxRequests = payloads.filter(item => new URL(item.request.url).pathname.endsWith("/Inbox"));
    const enrollmentIds = [...new Set(inboxRequests.map(item => enrollmentIdFromInboxUrl(item.request.url)).filter(Boolean))];
    if (enrollmentIds.length !== 1) throw new K12ConnectorError("K12 öğrenci seçimi doğrulanamadı. Tek bir öğrenci açıkken yeniden deneyin.", "k12_enrollment_unknown");
    const enrollmentId = enrollmentIds[0];
    if (expectedEnrollmentId && enrollmentId !== expectedEnrollmentId) {
      throw new K12ConnectorError("K12'de açık olan öğrenci bu Eğitim Pusulası profiliyle eşleşmiyor. Doğru öğrenciyi seçip yeniden deneyin.", "k12_profile_mismatch");
    }
    if (disallowedEnrollmentIds.has(enrollmentId)) {
      throw new K12ConnectorError("K12'de açık olan öğrenci başka bir Eğitim Pusulası profiline bağlı.", "k12_enrollment_already_linked");
    }
    if (!expectedEnrollmentId && !allowEnrollmentBinding) {
      throw new K12ConnectorError("İlk eşitlemede K12'de açık olan öğrenciyi seçili profile bağlamak için ayrıca onay gerekir.", "k12_binding_consent_required");
    }
    const ids = inboxPayloads.flatMap(responseRootResults).map(row => safeMessageId(firstText(row.ID, row.Id, row.id))).filter(Boolean).slice(0, MAX_RECORDS);
    const known = new Set([...knownExternalIds].map(canonicalMessageId));
    const newIds = ids.filter(id => !known.has(canonicalMessageId(id)));
    const detailPayloads = [];
    const detailDeadline = Date.now() + detailBudgetMs;
    let attemptedDetails = 0;
    for (const id of newIds) {
      const remainingMs = detailDeadline - Date.now();
      if (isAborted() || remainingMs <= 0) break;
      const expression = `(async()=>{const r=await fetch(${JSON.stringify(`${API_PREFIX}Messages/Message/${encodeURIComponent(id)}`)},{credentials:"include",headers:${JSON.stringify(inboxHeaders)}});if(!r.ok)throw new Error("HTTP "+r.status);return r.json()})()`;
      attemptedDetails += 1;
      try {
        const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: false }, Math.max(1, Math.min(COMMAND_TIMEOUT_MS, remainingMs)));
        if (result.result?.value) detailPayloads.push(result.result.value);
      } catch { /* retain the list entry when one detail cannot be fetched */ }
      if (isAborted()) break;
      if (Date.now() + 75 < detailDeadline) await wait(75);
    }

    const newCanonicalIds = new Set(newIds.map(canonicalMessageId));
    const records = normalizeK12Messages(inboxPayloads, detailPayloads, browser.origin)
      .filter(record => newCanonicalIds.has(canonicalMessageId(record.externalId)));

    return {
      records,
      origin: browser.origin,
      enrollmentId,
      scanned: ids.length,
      unchanged: ids.length - newIds.length,
      deferred: Math.max(0, newIds.length - attemptedDetails),
      listResponses: inboxPayloads.length,
      detailResponses: detailPayloads.length
    };
  } finally {
    removeListener();
    client.close();
  }
}

export async function syncK12Messages({
  endpoint = DEFAULT_CDP_ENDPOINT,
  fetchImpl = fetch,
  WebSocketImpl = WebSocket,
  knownExternalIds = [],
  expectedEnrollmentId = null,
  disallowedEnrollmentIds = [],
  allowEnrollmentBinding = false,
  detailBudgetMs = DETAIL_BUDGET_MS,
  totalTimeoutMs = TOTAL_TIMEOUT_MS
} = {}) {
  let timer;
  let activeClient;
  let aborted = false;
  try {
    return await Promise.race([
      syncK12MessagesInternal({
        endpoint,
        fetchImpl,
        WebSocketImpl,
        knownExternalIds,
        expectedEnrollmentId,
        disallowedEnrollmentIds: new Set(disallowedEnrollmentIds),
        allowEnrollmentBinding,
        detailBudgetMs,
        onClient: client => { activeClient = client; },
        isAborted: () => aborted
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          aborted = true;
          activeClient?.close();
          reject(new K12ConnectorError("K12 eşitlemesi toplam süre sınırını aştı.", "k12_sync_timeout"));
        }, totalTimeoutMs);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}
