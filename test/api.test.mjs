import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = path.resolve(import.meta.dirname, "..");

async function startServer(extraEnv = {}, preparedDataDir = null) {
  const dataDir = preparedDataDir ?? await mkdtemp(path.join(tmpdir(), "egitim-pusulasi-test-"));
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
      body: "Yarın, 21.10.2026 tarihinde çalışma kağıdını teslim ediniz.",
      occurredAt: "2026-10-21T10:00:00+03:00"
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
  assert.equal(dashboard.taskCount, 1);

  const digest = await fetch(`${app.base}/api/digest?profileId=${imported.items[0].profileId}&period=week&anchor=2026-10-21`).then(response => response.json());
  assert.equal(digest.sourceCount, 1);
  assert.equal(digest.urgentCount, 1);
  assert.equal(digest.taskCount, 1);
  assert.equal(digest.items[0].messageId, imported.items[0].id);
  assert.match(digest.note, /alınma tarihine/);
  const invalidDigest = await fetch(`${app.base}/api/digest?profileId=${imported.items[0].profileId}&period=month`);
  assert.equal(invalidDigest.status, 400);

  const calendarResponse = await fetch(`${app.base}/api/calendar.ics?profileId=${imported.items[0].profileId}`);
  const calendar = await calendarResponse.text();
  assert.equal(calendarResponse.status, 200);
  assert.equal(calendarResponse.headers.get("content-type"), "text/calendar; charset=utf-8");
  assert.equal(calendarResponse.headers.get("x-calendar-events"), "1");
  assert.equal(calendarResponse.headers.get("x-calendar-omitted-dates"), "1");
  assert.match(calendar, /DTSTART;VALUE=DATE:20261021/);
  assert.match(calendar, new RegExp(`Kaynak ileti: #${imported.items[0].id}`));

  const search = await fetch(`${app.base}/api/messages?q=çalışma`).then(response => response.json());
  assert.equal(search.length, 1);
  assert.match(search[0].body, /çalışma kağıdı/);

  const exported = await fetch(`${app.base}/api/export`).then(response => response.json());
  assert.equal(exported.schemaVersion, 4);
  assert.equal(exported.product, "Eğitim Pusulası");
  assert.deepEqual(exported.redactions, []);
  assert.equal(exported.items.length, 1);
  assert.equal(exported.items[0].analysis.category, "Ödev");

  const task = imported.items[0].analysis.actionItems[0];
  assert.match(task.key, /^[a-f0-9]{16}$/);
  assert.equal(task.completed, false);
  const completed = await fetch(`${app.base}/api/messages/${imported.items[0].id}/tasks/${task.key}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ completed: true })
  }).then(response => response.json());
  assert.equal(completed.analysis.actionItems[0].completed, true);
  const reanalyzed = await fetch(`${app.base}/api/messages/${imported.items[0].id}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "local" })
  }).then(response => response.json());
  assert.equal(reanalyzed.analysis.actionItems[0].completed, true);
  const completedExport = await fetch(`${app.base}/api/export`).then(response => response.json());
  assert.equal(completedExport.items[0].analysis.actionItems[0].completed, true);
  const completedDigest = await fetch(`${app.base}/api/digest?profileId=${imported.items[0].profileId}&period=week&anchor=2026-10-21`).then(response => response.json());
  assert.equal(completedDigest.taskCount, 0);
  const completedDashboard = await fetch(`${app.base}/api/dashboard?profileId=${imported.items[0].profileId}`).then(response => response.json());
  assert.equal(completedDashboard.taskCount, 0);
  const missingTask = await fetch(`${app.base}/api/messages/${imported.items[0].id}/tasks/0000000000000000`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ completed: true })
  });
  assert.equal(missingTask.status, 404);

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

test("ilk kurulum gizlilik onayı ister ve yerel profil adını kaydeder", async t => {
  const app = await startServer();
  t.after(() => app.close());
  const initial = await fetch(`${app.base}/api/setup`).then(response => response.json());
  assert.equal(initial.completed, false);
  assert.equal(initial.localOnlyByDefault, true);
  assert.equal(initial.aiConfigured, false);
  assert.equal(initial.k12PasswordStored, false);

  const rejected = await fetch(`${app.base}/api/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileName: "Takma Ad", privacyAcknowledged: false })
  });
  assert.equal(rejected.status, 400);

  const completed = await fetch(`${app.base}/api/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileName: "Takma Ad", privacyAcknowledged: true })
  }).then(response => response.json());
  assert.equal(completed.completed, true);
  assert.equal(completed.profile.name, "Takma Ad");
  assert.equal((await fetch(`${app.base}/api/setup`).then(response => response.json())).completed, true);
  assert.equal((await fetch(`${app.base}/api/profiles`).then(response => response.json()))[0].name, "Takma Ad");
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
    const sourceId = Number(payload.input.match(/ID: (\d+)/)?.[1]);
    const output = payload.input.includes("KAYNAKLAR:") ? {
      answer: "İletişim duyurusundaki numara kullanılmalıdır.",
      citations: [sourceId, 999999],
      uncertainty: ""
    } : {
        summary: "Maskeli ileti özeti",
        category: "Duyuru",
        priority: "normal",
        actionItems: [],
        dates: [],
        confidence: 0.9
      };
    const body = JSON.stringify({
      output_text: JSON.stringify(output)
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

  const [profile] = await fetch(`${app.base}/api/profiles`).then(response => response.json());
  const redactions = await fetch(`${app.base}/api/profiles/${profile.id}/redactions`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ terms: ["Deniz", "deniz"] })
  }).then(response => response.json());
  assert.deepEqual(redactions.terms, ["deniz"]);

  const imported = await fetch(`${app.base}/api/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source: "test",
      externalId: "ai-1",
      title: "İletişim duyurusu",
      sender: "ogretmen@example.com",
      body: "Deniz için detayları 0532 123 45 67 numarasından öğrenin."
    })
  }).then(response => response.json());
  assert.equal(imported.items[0].analysis.provider, "yerel-kural");
  assert.equal(calls, 0);

  const id = imported.items[0].id;
  const preview = await fetch(`${app.base}/api/messages/${id}/ai-preview`).then(response => response.json());
  assert.equal(preview.redactionEnabled, true);
  assert.deepEqual(preview.fields, ["title", "sender", "occurredAt", "body"]);
  assert.equal(preview.customRedactionTerms, 1);
  assert.equal(calls, 0);

  const analyzed = await fetch(`${app.base}/api/messages/${id}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "cloud" })
  }).then(response => response.json());
  assert.equal(calls, 1);
  assert.equal(analyzed.analysis.provider, "yapay-zeka-maskeli");
  assert.doesNotMatch(receivedInput, /ogretmen@example\.com|0532 123 45 67|Deniz/i);
  assert.doesNotMatch(receivedInput, /Çocuğum/);
  assert.match(receivedInput, /E-POSTA MASKELENDİ|TELEFON MASKELENDİ/);

  const question = "Deniz için iletişim detayı nedir?";
  const qaPreview = await fetch(`${app.base}/api/qa/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: profile.id, question })
  }).then(response => response.json());
  assert.equal(qaPreview.sourceCount, 1);
  assert.equal(qaPreview.sources[0].id, id);
  assert.equal(qaPreview.customRedactionTerms, 1);
  assert.equal(calls, 1);

  const denied = await fetch(`${app.base}/api/qa`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: profile.id, question, consent: false })
  });
  assert.equal(denied.status, 400);
  assert.equal(calls, 1);

  const foreignSource = await fetch(`${app.base}/api/qa`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: profile.id, question, sourceIds: [999999], consent: true })
  });
  assert.equal(foreignSource.status, 400);
  assert.equal(calls, 1);

  const answer = await fetch(`${app.base}/api/qa`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: profile.id, question, sourceIds: qaPreview.sources.map(source => source.id), consent: true })
  }).then(response => response.json());
  assert.equal(calls, 2);
  assert.equal(answer.provider, "yapay-zeka-maskeli");
  assert.deepEqual(answer.citations, [id]);
  assert.deepEqual(answer.sources.map(source => source.id), [id]);
  assert.doesNotMatch(receivedInput, /Deniz|0532 123 45 67|Çocuğum/i);
  assert.match(receivedInput, /ÖZEL İFADE MASKELENDİ|TELEFON MASKELENDİ/);
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

test("birden fazla çocuk profilini birbirinden ayırır", async t => {
  const app = await startServer();
  t.after(() => app.close());
  const initialProfiles = await fetch(`${app.base}/api/profiles`).then(response => response.json());
  assert.equal(initialProfiles.length, 1);
  assert.equal(initialProfiles[0].name, "Çocuğum");

  const secondProfile = await fetch(`${app.base}/api/profiles`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "İkinci profil" })
  }).then(response => response.json());

  await fetch(`${app.base}/api/profiles/${initialProfiles[0].id}/redactions`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ terms: ["Ada"] })
  });
  const secondRedactions = await fetch(`${app.base}/api/profiles/${secondProfile.id}/redactions`).then(response => response.json());
  assert.deepEqual(secondRedactions.terms, []);

  for (const profileId of [initialProfiles[0].id, secondProfile.id]) {
    const imported = await fetch(`${app.base}/api/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId, source: "test", externalId: "aynı-okul-kimliği", title: "Ortak duyuru", body: "Her çocuk için ayrı kayıt.", occurredAt: "2026-10-21T09:00:00+03:00" })
    }).then(response => response.json());
    assert.equal(imported.imported, 1);
    assert.equal(imported.items[0].profileId, profileId);
    assert.equal(imported.items[0].externalId, "aynı-okul-kimliği");
  }

  const firstDashboard = await fetch(`${app.base}/api/dashboard?profileId=${initialProfiles[0].id}`).then(response => response.json());
  const secondDashboard = await fetch(`${app.base}/api/dashboard?profileId=${secondProfile.id}`).then(response => response.json());
  assert.equal(firstDashboard.total, 1);
  assert.equal(secondDashboard.total, 1);
  const firstDigest = await fetch(`${app.base}/api/digest?profileId=${initialProfiles[0].id}&period=today&anchor=2026-10-21`).then(response => response.json());
  const secondDigest = await fetch(`${app.base}/api/digest?profileId=${secondProfile.id}&period=today&anchor=2026-10-21`).then(response => response.json());
  assert.equal(firstDigest.sourceCount, 1);
  assert.equal(secondDigest.sourceCount, 1);
  assert.ok(firstDigest.items.every(item => item.messageId !== secondDigest.items[0].messageId));

  await fetch(`${app.base}/api/messages?profileId=${initialProfiles[0].id}`, { method: "DELETE" });
  assert.equal((await fetch(`${app.base}/api/dashboard?profileId=${initialProfiles[0].id}`).then(response => response.json())).total, 0);
  assert.equal((await fetch(`${app.base}/api/dashboard?profileId=${secondProfile.id}`).then(response => response.json())).total, 1);

  const exported = await fetch(`${app.base}/api/export`).then(response => response.json());
  assert.equal(exported.profiles.length, 2);
  assert.equal(exported.redactions.length, 1);
  assert.equal(exported.redactions[0].profileId, initialProfiles[0].id);
  assert.equal(exported.redactions[0].term, "Ada");
  assert.equal(exported.items.length, 1);
  assert.equal(exported.items[0].profileName, "İkinci profil");
});

test("eski tek-profilli veritabanını veri kaybetmeden yükseltir", async t => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "egitim-pusulasi-legacy-"));
  const legacy = new DatabaseSync(path.join(dataDir, "egitim-pusulasi.db"));
  legacy.exec(`
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY, source TEXT NOT NULL DEFAULT 'manual', external_id TEXT,
      kind TEXT NOT NULL DEFAULT 'message', title TEXT NOT NULL, body TEXT NOT NULL,
      sender TEXT, occurred_at TEXT, source_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source, external_id)
    );
    CREATE TABLE analyses (
      message_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
      summary TEXT NOT NULL, category TEXT NOT NULL, priority TEXT NOT NULL,
      action_items TEXT NOT NULL, dates TEXT NOT NULL, confidence REAL NOT NULL,
      provider TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO messages(source, external_id, title, body) VALUES ('manual', 'legacy-1', 'Eski ileti', 'Korunacak içerik');
  `);
  legacy.close();

  const app = await startServer({}, dataDir);
  t.after(() => app.close());
  const profiles = await fetch(`${app.base}/api/profiles`).then(response => response.json());
  const messages = await fetch(`${app.base}/api/messages?profileId=${profiles[0].id}`).then(response => response.json());
  assert.equal(profiles.length, 1);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].title, "Eski ileti");
  assert.equal(messages[0].externalId, "legacy-1");
  assert.equal(messages[0].profileId, profiles[0].id);
  assert.equal((await fetch(`${app.base}/api/setup`).then(response => response.json())).completed, true);
});
