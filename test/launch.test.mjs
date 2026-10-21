import test from "node:test";
import assert from "node:assert/strict";
import { browserCommand, isEducationCompassHealthy, localAppUrl, waitUntilHealthy } from "../scripts/launch.mjs";

test("yerel uygulama adresini güvenli porttan üretir", () => {
  assert.equal(localAppUrl({}), "http://127.0.0.1:4173");
  assert.equal(localAppUrl({ PORT: "4312", HOST: "0.0.0.0" }), "http://127.0.0.1:4312");
  assert.throws(() => localAppUrl({ PORT: "70000" }), /1-65535/);
  assert.throws(() => localAppUrl({ PORT: "abc" }), /1-65535/);
});

test("platforma uygun tarayıcı komutunu sabit URL ile oluşturur", () => {
  const url = "http://127.0.0.1:4173";
  assert.deepEqual(browserCommand("win32", url), { command: "cmd.exe", args: ["/d", "/s", "/c", "start", "", url] });
  assert.deepEqual(browserCommand("darwin", url), { command: "open", args: [url] });
  assert.deepEqual(browserCommand("linux", url), { command: "xdg-open", args: [url] });
});

test("yalnızca Eğitim Pusulası sağlık yanıtını çalışan sunucu sayar", async () => {
  const healthyFetch = async () => ({ ok: true, json: async () => ({ ok: true, externalAiRequiresPerRequestConsent: true }) });
  const unrelatedFetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  assert.equal(await isEducationCompassHealthy("http://127.0.0.1:1", healthyFetch), true);
  assert.equal(await isEducationCompassHealthy("http://127.0.0.1:1", unrelatedFetch), false);
  assert.equal(await isEducationCompassHealthy("http://127.0.0.1:1", async () => { throw new Error("kapalı"); }), false);
});

test("sunucu sağlık verene kadar sınırlı sayıda dener", async () => {
  let calls = 0;
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ ok: ++calls >= 3, externalAiRequiresPerRequestConsent: true })
  });
  await waitUntilHealthy("http://127.0.0.1:1", { exitCode: null }, { attempts: 3, delayMs: 0, fetchImpl });
  assert.equal(calls, 3);
  await assert.rejects(() => waitUntilHealthy("http://127.0.0.1:1", { exitCode: 2 }, { attempts: 1, delayMs: 0, fetchImpl }), /kod 2/);
});
