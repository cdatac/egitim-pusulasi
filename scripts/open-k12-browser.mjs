import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_K12_URL = "https://www.k12net.com/";

export function isSafeK12Url(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "k12net.com" || url.hostname.endsWith(".k12net.com"));
  } catch {
    return false;
  }
}

export function chromeCandidates(platform, env = process.env) {
  if (platform === "win32") {
    return [
      env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
      env["PROGRAMFILES(X86)"] && path.join(env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
    ].filter(Boolean);
  }
  if (platform === "darwin") return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
  return ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"];
}

export function k12BrowserArgs({ profileDirectory, port, url = DEFAULT_K12_URL } = {}) {
  if (!profileDirectory) throw new Error("K12 Chrome profil dizini zorunludur");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("K12 Chrome bağlantı noktası geçersizdir");
  if (!isSafeK12Url(url)) throw new Error("K12 adresi HTTPS kullanan bir k12net.com adresi olmalıdır");
  return [
    "--remote-debugging-address=127.0.0.1",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDirectory}`,
    "--incognito",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=PasswordManagerOnboarding,PasswordLeakDetection",
    url
  ];
}

function findChrome(platform, env = process.env) {
  const candidates = chromeCandidates(platform, env);
  if (platform === "linux") return candidates.find(candidate => spawnSync("which", [candidate], { stdio: "ignore" }).status === 0) ?? null;
  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

export async function reserveLocalPort() {
  const server = net.createServer();
  server.unref();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForChrome(port, child, attempts = 60) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Chrome başlangıç sırasında kapandı (kod ${child.exitCode})`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch { /* Chrome henüz hazır olmayabilir */ }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error("Chrome güvenli bağlantı noktası zamanında hazır olmadı");
}

export async function removeOwnedConnectionFile(connectionFile, instanceId) {
  try {
    const current = JSON.parse(await readFile(connectionFile, "utf8"));
    if (current.instanceId !== instanceId) return false;
    await unlink(connectionFile);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const chrome = findChrome(process.platform);
  if (!chrome) throw new Error("Google Chrome bulunamadı. Chrome'u kurup bu başlatıcıyı yeniden çalıştırın.");
  const urlArgument = process.argv.find(value => value.startsWith("--url="))?.slice(6);
  const url = urlArgument || process.env.K12_URL || DEFAULT_K12_URL;
  const port = await reserveLocalPort();
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "egitim-pusulasi-k12-"));
  const dataDirectory = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
  const connectionFile = path.join(dataDirectory, "k12-connection.json");
  const legacyProfile = path.join(dataDirectory, "k12-chrome-profile");
  const instanceId = randomUUID();
  await mkdir(dataDirectory, { recursive: true });
  if (existsSync(legacyProfile)) console.warn("UYARI: v0.2.0'dan kalmış K12 tarayıcı verileri bulundu. Eğitim Pusulası > Ayarlar bölümünden bunları silin.");
  const child = spawn(chrome, k12BrowserArgs({ profileDirectory, port, url }), { stdio: "ignore", windowsHide: false });
  let ready = false;
  try {
    await waitForChrome(port, child);
    ready = true;
    await writeFile(connectionFile, `${JSON.stringify({ instanceId, port, pid: child.pid, createdAt: new Date().toISOString() })}\n`, { encoding: "utf8", mode: 0o600 });
    try { await chmod(connectionFile, 0o600); } catch { /* Windows izinleri işletim sistemi hesabıyla sınırlıdır */ }
    console.log("K12 bağlantı penceresi hazır. Bu geçici Chrome penceresinde veli hesabınıza giriş yapın.");
    console.log("Parola kaydetmeyin. Pencere kapanınca geçici profil ve bağlantı bilgisi silinir.");
    console.log("Ardından Eğitim Pusulası'nda 'Bağlantıyı kontrol et' ve 'K12'den eşitle' düğmelerini kullanın.");
    await once(child, "exit");
  } finally {
    if (!ready && child.exitCode === null) child.kill();
    await removeOwnedConnectionFile(connectionFile, instanceId);
    await rm(profileDirectory, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`HATA: ${error.message}`);
    process.exitCode = 1;
  });
}
