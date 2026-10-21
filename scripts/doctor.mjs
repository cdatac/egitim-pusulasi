import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function inspectEnvironment(env = process.env, nodeVersion = process.versions.node) {
  const errors = [];
  const warnings = [];
  const major = Number(String(nodeVersion).split(".")[0]);
  if (!Number.isFinite(major) || major < 24) errors.push(`Node.js 24 veya üzeri gerekli; bulunan sürüm: ${nodeVersion}`);

  const aiNames = ["AI_API_URL", "AI_API_KEY", "AI_MODEL"];
  const configured = aiNames.filter(name => Boolean(env[name]));
  if (configured.length > 0 && configured.length < aiNames.length) {
    errors.push(`AI yapılandırması yarım: ${aiNames.filter(name => !env[name]).join(", ")} eksik`);
  }
  if (env.AI_API_URL) {
    try {
      const protocol = new URL(env.AI_API_URL).protocol;
      if (!["http:", "https:"].includes(protocol)) errors.push("AI_API_URL yalnızca http veya https olabilir");
    } catch {
      errors.push("AI_API_URL geçerli bir URL değil");
    }
  }

  const host = env.HOST || "127.0.0.1";
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    warnings.push(`HOST=${host}: uygulama yerel ağdan erişilebilir olabilir; kimlik doğrulama henüz yok`);
  }

  const dataDir = path.resolve(env.DATA_DIR || path.join(ROOT, "data"));
  try {
    await mkdir(dataDir, { recursive: true });
    await access(dataDir, constants.R_OK | constants.W_OK);
    const probe = path.join(dataDir, `.write-test-${process.pid}-${Date.now()}`);
    await writeFile(probe, "ok", { flag: "wx" });
    await rm(probe);
  } catch (error) {
    errors.push(`Veri dizini yazılabilir değil: ${dataDir} (${error.code ?? error.message})`);
  }

  return {
    ok: errors.length === 0,
    nodeVersion,
    host,
    dataDir,
    aiConfigured: configured.length === aiNames.length,
    aiRedactionEnabled: env.AI_REDACT !== "false",
    errors,
    warnings
  };
}

async function main() {
  const result = await inspectEnvironment();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`Eğitim Pusulası başlangıç denetimi: ${result.ok ? "hazır" : "hatalı"}`);
    for (const warning of result.warnings) console.warn(`UYARI: ${warning}`);
    for (const error of result.errors) console.error(`HATA: ${error}`);
  }
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
