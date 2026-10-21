import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { inspectEnvironment } from "../scripts/doctor.mjs";

async function temporaryDataDir(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "egitim-pusulasi-doctor-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("varsayılan yerel yapılandırmayı hazır kabul eder", async t => {
  const result = await inspectEnvironment({ DATA_DIR: await temporaryDataDir(t) }, "24.14.1");
  assert.equal(result.ok, true);
  assert.equal(result.host, "127.0.0.1");
  assert.equal(result.aiConfigured, false);
  assert.deepEqual(result.warnings, []);
});

test("yarım AI yapılandırmasını uygulama başlamadan reddeder", async t => {
  const result = await inspectEnvironment({
    DATA_DIR: await temporaryDataDir(t),
    AI_API_URL: "https://example.invalid/v1/responses",
    AI_API_KEY: "test"
  }, "24.14.1");
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /AI_MODEL eksik/);
});

test("ağ arayüzüne bağlanma seçimini görünür uyarı yapar", async t => {
  const result = await inspectEnvironment({ DATA_DIR: await temporaryDataDir(t), HOST: "0.0.0.0" }, "24.14.1");
  assert.equal(result.ok, true);
  assert.match(result.warnings.join(" "), /yerel ağdan erişilebilir/);
});

test("eski Node sürümünü reddeder", async t => {
  const result = await inspectEnvironment({ DATA_DIR: await temporaryDataDir(t) }, "22.0.0");
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /Node\.js 24/);
});
