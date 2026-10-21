import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { inspectEnvironment } from "./doctor.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function localAppUrl(env = process.env) {
  const port = Number(env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT 1-65535 arasında bir tam sayı olmalıdır");
  return `http://127.0.0.1:${port}`;
}

export function browserCommand(platform, url) {
  if (platform === "win32") return { command: "cmd.exe", args: ["/d", "/s", "/c", "start", "", url] };
  if (platform === "darwin") return { command: "open", args: [url] };
  return { command: "xdg-open", args: [url] };
}

export async function isEducationCompassHealthy(url, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(`${url}/api/health`, { signal: AbortSignal.timeout(800) });
    if (!response.ok) return false;
    const result = await response.json();
    return result?.ok === true && typeof result.cloudRequiresPerMessageConsent === "boolean";
  } catch {
    return false;
  }
}

export async function waitUntilHealthy(url, child, { attempts = 80, delayMs = 100, fetchImpl = fetch } = {}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (child.startupError) throw new Error(`Sunucu süreci başlatılamadı: ${child.startupError.message}`);
    if (child.exitCode !== null) throw new Error(`Sunucu başlangıç sırasında kapandı (kod ${child.exitCode})`);
    if (await isEducationCompassHealthy(url, fetchImpl)) return;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error("Yerel sunucu zamanında hazır olmadı");
}

function openBrowser(url) {
  const target = browserCommand(process.platform, url);
  const opener = spawn(target.command, target.args, { detached: true, stdio: "ignore", windowsHide: true });
  opener.on("error", error => console.warn(`Tarayıcı otomatik açılamadı: ${error.message}`));
  opener.unref();
}

async function main() {
  const inspection = await inspectEnvironment();
  for (const warning of inspection.warnings) console.warn(`UYARI: ${warning}`);
  if (!inspection.ok) {
    for (const error of inspection.errors) console.error(`HATA: ${error}`);
    process.exitCode = 1;
    return;
  }

  const url = localAppUrl();
  const noBrowser = process.argv.includes("--no-browser");
  if (await isEducationCompassHealthy(url)) {
    console.log(`Eğitim Pusulası zaten çalışıyor: ${url}`);
    if (!noBrowser) openBrowser(url);
    return;
  }

  console.log("Eğitim Pusulası başlatılıyor…");
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server.mjs"], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
    windowsHide: true
  });
  child.startupError = null;
  child.once("error", error => { child.startupError = error; });
  const stop = () => {
    if (child.exitCode === null) child.kill("SIGTERM");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  try {
    await waitUntilHealthy(url, child);
    console.log(`Hazır: ${url}`);
    if (!noBrowser) openBrowser(url);
    const code = await new Promise(resolve => child.once("exit", resolve));
    process.exitCode = Number(code ?? 0);
  } catch (error) {
    stop();
    console.error(`HATA: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
