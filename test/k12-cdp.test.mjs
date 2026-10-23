import test from "node:test";
import assert from "node:assert/strict";
import { inspectK12Browser, K12ConnectorError, normalizeK12Messages, syncK12Messages } from "../lib/connectors/k12-cdp.mjs";

test("yalnızca HTTPS K12 hedefini seçer", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => [
      { id: "other", type: "page", url: "https://example.com/", webSocketDebuggerUrl: "ws://127.0.0.1:9222/other" },
      { id: "unsafe", type: "page", url: "http://school.k12net.com/SPTS.Web/", webSocketDebuggerUrl: "ws://127.0.0.1:9222/unsafe" },
      { id: "remote", type: "page", url: "https://school.k12net.com/SPTS.Web/", webSocketDebuggerUrl: "ws://192.0.2.1:9222/remote" },
      { id: "k12", type: "page", url: "https://school.k12net.com/SPTS.Web/", webSocketDebuggerUrl: "ws://127.0.0.1:9222/k12" }
    ]
  });
  const status = await inspectK12Browser({ fetchImpl });
  assert.equal(status.available, true);
  assert.equal(status.loggedIn, true);
  assert.equal(status.origin, "https://school.k12net.com");
  assert.equal(status.targetId, "k12");
});

test("K12 liste ve ayrıntı yanıtlarını ortak ileti biçimine dönüştürür", () => {
  const list = [{ RootResults: [{
    ID: "{11111111-1111-1111-1111-111111111111}",
    Subject: "Gezi duyurusu",
    SendDate: "2026-10-22T09:00:00+03:00",
    Type: { Code: "Announcement" },
    Sender: { Name: { FullName: "Okul Yönetimi" } }
  }] }];
  const details = [{ RootResults: [{
    ID: "{11111111-1111-1111-1111-111111111111}",
    Body: "<p>Cuma günü <strong>müze</strong> gezisi yapılacaktır.</p>"
  }] }];
  const [record] = normalizeK12Messages(list, details, "https://school.k12net.com");
  assert.deepEqual(record, {
    externalId: "{11111111-1111-1111-1111-111111111111}",
    kind: "announcement",
    title: "Gezi duyurusu",
    body: "Cuma günü müze gezisi yapılacaktır.",
    sender: "Okul Yönetimi",
    occurredAt: "2026-10-22T09:00:00+03:00",
    sourceUrl: "https://school.k12net.com/SPTS.Web/WebParts/Message/#/",
    bodyComplete: true
  });
});

test("ayrıntısı alınamayan iletide başlığı güvenli gövde olarak kullanır", () => {
  const [record] = normalizeK12Messages([{ RootResults: [{ ID: "abc", Subject: "Kısa bilgi" }] }]);
  assert.equal(record.kind, "message");
  assert.equal(record.body, "Kısa bilgi");
  assert.equal(record.bodyComplete, false);
});

test("çift kodlanmış HTML metnini etikete dönüştürmez", () => {
  const [record] = normalizeK12Messages([{ RootResults: [{ ID: "abc", Subject: "Bilgi" }] }], [{ RootResults: [{ ID: "abc", Body: "&amp;lt;script&amp;gt;" }] }]);
  assert.equal(record.body, "&lt;script&gt;");
});

test("liste ve ayrıntı kimliklerini parantez ve harf biçiminden bağımsız eşleştirir", () => {
  const [record] = normalizeK12Messages(
    [{ RootResults: [{ ID: "{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}", Subject: "Bilgi" }] }],
    [{ RootResults: [{ ID: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", Body: "Tam ayrıntı" }] }]
  );
  assert.equal(record.body, "Tam ayrıntı");
  assert.equal(record.bodyComplete, true);
});

test("K12 .NET tarihini standart ISO tarihe dönüştürür", () => {
  const [record] = normalizeK12Messages([{ RootResults: [{ ID: "abc", Subject: "Bilgi", SendDate: "/Date(1792652400000+0300)/" }] }]);
  assert.equal(record.occurredAt, "2026-10-22T07:00:00.000Z");
});

test("eşitleme yalnızca yeni ileti ayrıntısını alır ve öğrenci kimliğini doğrular", async () => {
  const knownId = "{11111111-1111-1111-1111-111111111111}";
  const newId = "{22222222-2222-2222-2222-222222222222}";
  let evaluated = 0;
  class FakeWebSocket {
    constructor() {
      this.listeners = new Map();
      queueMicrotask(() => this.emit("open", {}));
    }
    addEventListener(name, listener) {
      const rows = this.listeners.get(name) ?? [];
      rows.push(listener);
      this.listeners.set(name, rows);
    }
    emit(name, value) {
      for (const listener of this.listeners.get(name) ?? []) listener(value);
    }
    message(value) { this.emit("message", { data: JSON.stringify(value) }); }
    send(raw) {
      const command = JSON.parse(raw);
      if (command.method === "Page.navigate") {
        this.message({ id: command.id, result: {} });
        queueMicrotask(() => {
          const url = "https://school.k12net.com/SPCore.Web/api/Messages/ogrenci-123/Inbox";
          this.message({ method: "Network.requestWillBeSent", params: { requestId: "inbox-1", request: { url, method: "GET", headers: { AppId: "sentetik" } } } });
          this.message({ method: "Network.responseReceived", params: { requestId: "inbox-1", response: { status: 200 } } });
          this.message({ method: "Network.loadingFinished", params: { requestId: "inbox-1" } });
        });
        return;
      }
      if (command.method === "Network.getResponseBody") {
        const body = JSON.stringify({ RootResults: [
          { ID: knownId, Subject: "Daha önce alınmış" },
          { ID: newId, Subject: "Yeni ileti", Type: { Code: "Announcement" } }
        ] });
        this.message({ id: command.id, result: { body, base64Encoded: false } });
        return;
      }
      if (command.method === "Runtime.evaluate") {
        evaluated += 1;
        assert.match(command.params.expression, /22222222-2222-2222-2222-222222222222/);
        assert.doesNotMatch(command.params.expression, /11111111-1111-1111-1111-111111111111/);
        this.message({ id: command.id, result: { result: { value: { RootResults: [{ ID: newId, Body: "Yeni ileti ayrıntısı" }] } } } });
        return;
      }
      this.message({ id: command.id, result: {} });
    }
    close() { this.emit("close", {}); }
  }
  const fetchImpl = async () => ({ ok: true, json: async () => [{ id: "k12", type: "page", url: "https://school.k12net.com/SPTS.Web/", webSocketDebuggerUrl: "ws://127.0.0.1:9222/k12" }] });
  await assert.rejects(
    () => syncK12Messages({ fetchImpl, WebSocketImpl: FakeWebSocket, knownExternalIds: [knownId] }),
    error => error instanceof K12ConnectorError && error.code === "k12_binding_consent_required"
  );
  assert.equal(evaluated, 0);
  await assert.rejects(
    () => syncK12Messages({ fetchImpl, WebSocketImpl: FakeWebSocket, knownExternalIds: [knownId], expectedEnrollmentId: "baska-ogrenci", allowEnrollmentBinding: true }),
    error => error instanceof K12ConnectorError && error.code === "k12_profile_mismatch"
  );
  assert.equal(evaluated, 0);
  const partial = await syncK12Messages({ fetchImpl, WebSocketImpl: FakeWebSocket, knownExternalIds: [knownId], allowEnrollmentBinding: true, detailBudgetMs: 0 });
  assert.equal(partial.deferred, 1);
  assert.equal(partial.records.length, 1);
  assert.equal(partial.records[0].bodyComplete, false);
  assert.equal(evaluated, 0);
  const result = await syncK12Messages({ fetchImpl, WebSocketImpl: FakeWebSocket, knownExternalIds: [knownId], allowEnrollmentBinding: true });
  assert.equal(result.enrollmentId, "ogrenci-123");
  assert.equal(result.scanned, 2);
  assert.equal(result.unchanged, 1);
  assert.equal(result.detailResponses, 1);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].body, "Yeni ileti ayrıntısı");
  assert.equal(result.records[0].bodyComplete, true);
  assert.equal(evaluated, 1);
});

test("yanıt vermeyen CDP oturumunu toplam zaman aşımıyla kapatır", async () => {
  class SilentWebSocket {
    constructor() { this.listeners = new Map(); queueMicrotask(() => this.emit("open", {})); }
    addEventListener(name, listener) { const rows = this.listeners.get(name) ?? []; rows.push(listener); this.listeners.set(name, rows); }
    send() {}
    close() { this.emit("close", {}); }
    emit(name, event) { for (const listener of this.listeners.get(name) ?? []) listener(event); }
  }
  const fetchImpl = async () => ({ ok: true, json: async () => [{ id: "k12", type: "page", url: "https://school.k12net.com/SPTS.Web/", webSocketDebuggerUrl: "ws://127.0.0.1:9222/k12" }] });
  await assert.rejects(
    () => syncK12Messages({ fetchImpl, WebSocketImpl: SilentWebSocket, totalTimeoutMs: 25 }),
    error => error instanceof K12ConnectorError && ["k12_sync_timeout", "cdp_disconnected"].includes(error.code)
  );
});
