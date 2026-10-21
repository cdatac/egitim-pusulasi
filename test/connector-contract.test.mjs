import test from "node:test";
import assert from "node:assert/strict";
import { ConnectorValidationError, normalizeConnectorItems, normalizeK12NotificationItems } from "../lib/connectors/contract.mjs";

test("K12 kayıtlarını salt okunur ortak biçime dönüştürür", () => {
  const [item] = normalizeConnectorItems("k12", [{
    kind: "announcement",
    title: "Gezi duyurusu",
    body: "Cuma günü müze gezisi yapılacaktır.",
    sender: "Okul yönetimi",
    occurredAt: "2026-10-21T10:00:00+03:00",
    sourceUrl: "https://user:pass@okul.example/duyuru?id=42&token=gizli"
  }]);

  assert.equal(item.source, "connector:k12");
  assert.equal(item.kind, "announcement");
  assert.equal(item.externalId.length, 32);
  assert.equal(item.sourceUrl, "https://okul.example/duyuru?id=42");
  assert.doesNotMatch(item.sourceUrl, /pass|token|gizli/);
});

test("aynı içerik için kararlı dış kimlik üretir", () => {
  const record = { title: "Aynı", body: "Aynı içerik", occurredAt: "2026-10-21" };
  const first = normalizeConnectorItems("k12", [record])[0];
  const second = normalizeConnectorItems("k12", [record])[0];
  assert.equal(first.externalId, second.externalId);
});

test("kimlik bilgisi alanlarını içe aktarma sınırında reddeder", () => {
  assert.throws(
    () => normalizeConnectorItems("k12", [{ title: "x", body: "y", metadata: { accessToken: "gizli" } }]),
    error => error instanceof ConnectorValidationError && /kimlik bilgisi/.test(error.message)
  );
});

test("bilinmeyen bağlayıcıyı reddeder", () => {
  assert.throws(() => normalizeConnectorItems("bilinmeyen", []), /Bilinmeyen bağlayıcı/);
});

test("K12 bildirim dışa aktarımını yönlendirme alanlarını saklamadan dönüştürür", () => {
  const [item] = normalizeK12NotificationItems([{
    title: "Proje hatırlatması",
    message: "Fen projesi cuma günü teslim edilecektir.",
    body: "yedek gövde",
    receivedAt: "2026-10-21T12:30:00+03:00",
    intent: "uygulama-içi-eylem",
    portal: "veli-portalı",
    query: "özel-yönlendirme"
  }]);

  assert.equal(item.title, "Proje hatırlatması");
  assert.equal(item.body, "Fen projesi cuma günü teslim edilecektir.");
  assert.equal(item.occurredAt, "2026-10-21T12:30:00+03:00");
  assert.doesNotMatch(JSON.stringify(item), /uygulama-içi-eylem|veli-portalı|özel-yönlendirme/);
});

test("K12 bildirim dışa aktarımında sır alanlarını reddeder", () => {
  assert.throws(
    () => normalizeK12NotificationItems([{ title: "x", message: "y", metadata: { sessionId: "gizli" } }]),
    error => error instanceof ConnectorValidationError && /kimlik bilgisi/.test(error.message)
  );
});
