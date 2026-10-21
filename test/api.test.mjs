import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

async function startServer(extraEnv = {}) {
  const dataDir = await mkdtemp(path.join(tmpdir(), "egitim-pusulasi-test-"));
  const port = 42000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server.mjs"], {
    cwd: root,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDir, AI_API_URL: "", AI_API_KEY: "", AI_MODEL: "", ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"]
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Sunucu başlatma zaman aşımı")), 8000);
    child.once("error", reject);
    child.stderr.on("data", data => reject(new Error(data.toString())));
    child.stdout.on("data", data => {
      if (data.toString().includes("Eğitim Pusulası:")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  return {
    base: `http://127.0.0.1:${port}`,
    async close() {
      child.kill("SIGTERM");
      await new Promise(resolve => child.once("exit", resolve));
      await rm(dataDir, { recursive: true, force: true });
    }
  };
}

test("sağlık, içe aktarma, analiz ve pano akışı", async t => {
  const app = await startServer();
  t.after(() => app.close());

  const health = await fetch(`${app.base}/api/health`).then(response => response.json());
  assert.deepEqual(health, { ok: true, aiConfigured: false, cloudRequiresPerMessageConsent: true });

  const importResponse = await fetch(`${app.base}/api/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "test",
      externalId: "duyuru-1",
      title: "Matematik ödevi",
      body: "Yarın çalışma kağıdını teslim ediniz."
    })
  });
  assert.equal(importResponse.status, 201);
  const imported = await importResponse.json();
  assert.equal(imported.imported, 1);
  assert.equal(imported.items[0].analysis.category, "Ödev");
  assert.equal(imported.items[0].analysis.priority, "yüksek");

  const duplicateResponse = await fetch(`${app.base}/api/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source: "test", externalId: "duyuru-1", title: "Tekrar", body: "Aynı ileti" })
  });
  assert.equal((await duplicateResponse.json()).imported, 0);

  const dashboard = await fetch(`${app.base}/api/dashboard`).then(response => response.json());
  assert.equal(dashboard.total, 1);
  assert.equal(dashboard.urgent, 1);

  const search = await fetch(`${app.base}/api/messages?q=çalışma`).then(response => response.json());
  assert.equal(search.length, 1);
  assert.match(search[0].body, /çalışma kağıdı/);

  const exported = await fetch(`${app.base}/api/export`).then(response => response.json());
  assert.equal(exported.schemaVersion, 1);
  assert.equal(exported.product, "Eğitim Pusulası");
  assert.equal(exported.items.length, 1);
  assert.equal(exported.items[0].analysis.category, "Ödev");

  const deleted = await fetch(`${app.base}/api/messages/${imported.items[0].id}`, { method: "DELETE" }).then(response => response.json());
  assert.equal(deleted.deleted, 1);
  assert.equal((await fetch(`${app.base}/api/messages`).then(response => response.json())).length, 0);
});

test("boş gövdeyi içe aktarmaz", async t => {
  const app = await startServer();
  t.after(() => app.close());
  const response = await fetch(`${app.base}/api/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Boş", body: "" })
  });
  assert.equal((await response.json()).imported, 0);
});

test("tüm yerel veriyi temizler", async t => {
  const app = await startServer();
  t.after(() => app.close());
  for (const externalId of ["a", "b"]) {
    await fetch(`${app.base}/api/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "test", externalId, title: externalId, body: `${externalId} mesajı` })
    });
  }
  const cleared = await fetch(`${app.base}/api/messages`, { method: "DELETE" }).then(response => response.json());
  assert.equal(cleared.deleted, 2);
  assert.equal((await fetch(`${app.base}/api/dashboard`).then(response => response.json())).total, 0);
});

test("yabancı web kaynağından localhost erişimini reddeder", async t => {
  const app = await startServer();
  t.after(() => app.close());
  const response = await fetch(`${app.base}/api/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://kotu-ornek.invalid" },
    body: JSON.stringify({ title: "İstenmeyen", body: "Bu kayıt oluşmamalı" })
  });
  assert.equal(response.status, 403);
  assert.equal((await fetch(`${app.base}/api/dashboard`).then(value => value.json())).total, 0);
});

test("bulut AI yapılandırılsa bile yalnızca ileti başına onaylı çağrıda veri gönderir", async t => {
  let calls = 0;
  let receivedInput = "";
  const mock = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    calls += 1;
    receivedInput = payload.input;
    const body = JSON.stringify({
      output_text: JSON.stringify({
        summary: "Maskeli ileti özeti",
        category: "Duyuru",
        priority: "normal",
        actionItems: [],
        dates: [],
        confidence: 0.9
      })
    });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
  });
  await new Promise(resolve => mock.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => mock.close(resolve)));
  const mockPort = mock.address().port;
  const app = await startServer({
    AI_API_URL: `http://127.0.0.1:${mockPort}/responses`,
    AI_API_KEY: "test-key",
    AI_MODEL: "test-model",
    AI_REDACT: "true"
  });
  t.after(() => app.close());

  const imported = await fetch(`${app.base}/api/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "test",
      externalId: "ai-1",
      title: "İletişim duyurusu",
      sender: "ogretmen@example.com",
      body: "Detay için 0532 123 45 67 numarasını arayın."
    })
  }).then(response => response.json());
  assert.equal(imported.items[0].analysis.provider, "yerel-kural");
  assert.equal(calls, 0);

  const id = imported.items[0].id;
  const preview = await fetch(`${app.base}/api/messages/${id}/ai-preview`).then(response => response.json());
  assert.equal(preview.redactionEnabled, true);
  assert.deepEqual(preview.fields, ["title", "sender", "occurredAt", "body"]);
  assert.equal(calls, 0);

  const analyzed = await fetch(`${app.base}/api/messages/${id}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "cloud" })
  }).then(response => response.json());
  assert.equal(calls, 1);
  assert.equal(analyzed.analysis.provider, "yapay-zeka-maskeli");
  assert.doesNotMatch(receivedInput, /ogretmen@example\.com|0532 123 45 67/);
  assert.match(receivedInput, /E-POSTA MASKELENDİ|TELEFON MASKELENDİ/);
});

test("K12 bağlayıcı sözleşmesi kayıtları içe aktarır, tekrarları ayıklar ve sırları reddeder", async t => {
  const app = await startServer();
  t.after(() => app.close());

  const connectors = await fetch(`${app.base}/api/connectors`).then(response => response.json());
  assert.equal(connectors[0].id, "k12");
  assert.equal(connectors[0].mode, "read-only");
  assert.equal(connectors[0].networkImplementationAvailable, false);

  const record = { kind: "announcement", title: "Duyuru", body: "Cuma günü etkinlik var.", occurredAt: "2026-10-23" };
  const first = await fetch(`${app.base}/api/connectors/k12/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records: [record] })
  }).then(response => response.json());
  assert.equal(first.imported, 1);
  assert.equal(first.items[0].source, "connector:k12");

  const duplicate = await fetch(`${app.base}/api/connectors/k12/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records: [record] })
  }).then(response => response.json());
  assert.equal(duplicate.imported, 0);

  const rejected = await fetch(`${app.base}/api/connectors/k12/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ records: [{ title: "x", body: "y", password: "asla-kabul-etme" }] })
  });
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /kimlik bilgisi/);
});
