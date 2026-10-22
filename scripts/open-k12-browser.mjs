import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
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

export function k12BrowserArgs({ profileDirectory, url = DEFAULT_K12_URL } = {}) {
  if (!profileDirectory) throw new Error("K12 Chrome profil dizini zorunludur");
  if (!isSafeK12Url(url)) throw new Error("K12 adresi HTTPS kullanan bir k12net.com adresi olmalıdır");
  return [
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=9222",
    `--user-data-dir=${profileDirectory}`,
    "--no-first-run",
    "--no-default-browser-check",
    url
  ];
}

function findChrome(platform, env = process.env) {
  const candidates = chromeCandidates(platform, env);
  if (platform === "linux") {
    return candidates.find(candidate => spawnSync("which", [candidate], { stdio: "ignore" }).status === 0) ?? null;
  }
  return candidates.find(candidate => existsSync(candidate)) ?? null;
}

async function main() {
  const chrome = findChrome(process.platform);
  if (!chrome) {
    throw new Error("Google Chrome bulunamadı. Chrome'u kurup bu başlatıcıyı yeniden çalıştırın.");
  }
  const urlArgument = process.argv.find(value => value.startsWith("--url="))?.slice(6);
  const url = urlArgument || process.env.K12_URL || DEFAULT_K12_URL;
  const profileDirectory = path.join(ROOT, "data", "k12-chrome-profile");
  const child = spawn(chrome, k12BrowserArgs({ profileDirectory, url }), {
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.once("error", error => {
    console.error(`K12 Chrome penceresi açılamadı: ${error.message}`);
    process.exitCode = 1;
  });
  child.unref();
  console.log("K12 bağlantı penceresi açıldı. Bu ayrı Chrome penceresinde veli hesabınıza giriş yapın.");
  console.log("Ardından Eğitim Pusulası'nda 'Bağlantıyı kontrol et' ve 'K12'den eşitle' düğmelerini kullanın.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`HATA: ${error.message}`);
    process.exitCode = 1;
  });
}
