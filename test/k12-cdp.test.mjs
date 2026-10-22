import test from "node:test";
import assert from "node:assert/strict";
import { inspectK12Browser, normalizeK12Messages } from "../lib/connectors/k12-cdp.mjs";

test("yalnızca HTTPS K12 hedefini seçer", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => [
      { id: "other", type: "page", url: "https://example.com/", webSocketDebuggerUrl: "ws://127.0.0.1/other" },
      { id: "unsafe", type: "page", url: "http://school.k12net.com/SPTS.Web/", webSocketDebuggerUrl: "ws://127.0.0.1/unsafe" },
      { id: "k12", type: "page", url: "https://school.k12net.com/SPTS.Web/", webSocketDebuggerUrl: "ws://127.0.0.1/k12" }
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
    sourceUrl: "https://school.k12net.com/SPTS.Web/WebParts/Message/#/"
  });
});

test("ayrıntısı alınamayan iletide başlığı güvenli gövde olarak kullanır", () => {
  const [record] = normalizeK12Messages([{ RootResults: [{ ID: "abc", Subject: "Kısa bilgi" }] }]);
  assert.equal(record.kind, "message");
  assert.equal(record.body, "Kısa bilgi");
});
