import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

async function startServer() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "egitim-pusulasi-test-"));
  const port = 42000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server.mjs"], {
    cwd: root,
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), DATA_DIR: dataDir, AI_API_URL: "", AI_API_KEY: "", AI_MODEL: "" },
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
  assert.deepEqual(health, { ok: true, aiConfigured: false });

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
