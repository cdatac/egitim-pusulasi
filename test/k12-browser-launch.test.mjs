import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromeCandidates, isSafeK12Url, k12BrowserArgs, removeOwnedConnectionFile } from "../scripts/open-k12-browser.mjs";

test("K12 başlatıcısı yalnızca güvenli K12 adreslerini kabul eder", () => {
  assert.equal(isSafeK12Url("https://www.k12net.com/"), true);
  assert.equal(isSafeK12Url("https://okul.k12net.com/SPTS.Web/"), true);
  assert.equal(isSafeK12Url("http://okul.k12net.com/"), false);
  assert.equal(isSafeK12Url("https://k12net.com.example/"), false);
});

test("K12 Chrome yalnızca localhost denetimi ve ayrı profil ile açılır", () => {
  const profileDirectory = path.join("C:", "sentetik", "k12-profile");
  const args = k12BrowserArgs({ profileDirectory, port: 43127, url: "https://okul.k12net.com/" });
  assert.ok(args.includes("--remote-debugging-address=127.0.0.1"));
  assert.ok(args.includes("--remote-debugging-port=43127"));
  assert.ok(args.includes("--incognito"));
  assert.ok(args.includes(`--user-data-dir=${profileDirectory}`));
  assert.throws(() => k12BrowserArgs({ profileDirectory, port: 43127, url: "https://example.com/" }), /k12net\.com/);
});

test("Windows Chrome yolları bilinen kullanıcı ve program dizinlerinden üretilir", () => {
  const candidates = chromeCandidates("win32", {
    PROGRAMFILES: "C:\\Program Files",
    "PROGRAMFILES(X86)": "C:\\Program Files (x86)",
    LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local"
  });
  assert.equal(candidates.length, 3);
  assert.match(candidates[0], /Google[\\/]Chrome[\\/]Application[\\/]chrome\.exe$/);
});

test("yalnızca kendi başlatıcı örneğine ait bağlantı dosyasını siler", async t => {
  const directory = await mkdtemp(path.join(tmpdir(), "egitim-pusulasi-connection-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "k12-connection.json");
  await writeFile(file, JSON.stringify({ instanceId: "ikinci" }), "utf8");
  assert.equal(await removeOwnedConnectionFile(file, "birinci"), false);
  assert.equal(existsSync(file), true);
  assert.equal(await removeOwnedConnectionFile(file, "ikinci"), true);
  assert.equal(existsSync(file), false);
});
