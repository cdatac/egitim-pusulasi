import { createHash } from "node:crypto";

const SENSITIVE_KEY = /^(?:pass(?:word)?|token|accessToken|refreshToken|cookie|authorization|session|sessionId|secret|apiKey)$/i;
const SENSITIVE_QUERY = /^(?:token|access_token|refresh_token|auth|authorization|session|sessionid|code|key)$/i;

export class ConnectorValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConnectorValidationError";
  }
}

export const connectorDescriptors = Object.freeze([
  Object.freeze({
    id: "k12",
    name: "K12",
    mode: "read-only",
    capabilities: Object.freeze(["announcements", "messages", "notification-import", "local-browser-sync"]),
    status: "experimental-runtime-verified",
    networkImplementationAvailable: true,
    notificationImportAvailable: true
  })
]);

function assertNoCredentialFields(value, location = "record") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCredentialFields(item, `${location}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) throw new ConnectorValidationError(`${location}.${key} kimlik bilgisi alanı kabul edilmez`);
    assertNoCredentialFields(nested, `${location}.${key}`);
  }
}

function cleanText(value, maximum) {
  return value == null ? null : String(value).trim().slice(0, maximum);
}

function sanitizeSourceUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return null;
  }
}

function stableExternalId(connectorId, record) {
  const material = [connectorId, record.kind, record.title, record.body, record.sender, record.occurredAt].join("\u001f");
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

export function normalizeConnectorItems(connectorId, records) {
  const descriptor = connectorDescriptors.find(item => item.id === connectorId);
  if (!descriptor) throw new ConnectorValidationError(`Bilinmeyen bağlayıcı: ${connectorId}`);
  if (!Array.isArray(records)) throw new ConnectorValidationError("records bir dizi olmalıdır");
  if (records.length > 250) throw new ConnectorValidationError("Tek istekte en fazla 250 kayıt kabul edilir");

  return records.map((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new ConnectorValidationError(`record[${index}] nesne olmalıdır`);
    }
    assertNoCredentialFields(record, `record[${index}]`);
    const body = cleanText(record.body, 40_000);
    if (!body) throw new ConnectorValidationError(`record[${index}].body boş olamaz`);
    const kind = ["announcement", "message"].includes(record.kind) ? record.kind : "message";
    const item = {
      source: `connector:${connectorId}`,
      externalId: cleanText(record.externalId, 500),
      kind,
      title: cleanText(record.title, 400) || "Başlıksız",
      body,
      sender: cleanText(record.sender, 400),
      occurredAt: cleanText(record.occurredAt, 100),
      sourceUrl: sanitizeSourceUrl(record.sourceUrl),
      bodyComplete: record.bodyComplete !== false
    };
    item.externalId ||= stableExternalId(connectorId, item);
    return item;
  });
}

export function normalizeK12NotificationItems(records) {
  if (!Array.isArray(records)) throw new ConnectorValidationError("records bir dizi olmalıdır");

  const mapped = records.map((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new ConnectorValidationError(`record[${index}] nesne olmalıdır`);
    }
    assertNoCredentialFields(record, `record[${index}]`);
    return {
      externalId: record.externalId,
      kind: record.kind,
      title: record.title,
      body: record.message ?? record.body,
      sender: record.sender,
      occurredAt: record.receivedAt ?? record.occurredAt,
      sourceUrl: record.sourceUrl,
      bodyComplete: false
    };
  });

  return normalizeConnectorItems("k12", mapped);
}
