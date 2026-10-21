import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ISSUE_CONFIG = ".github/ISSUE_TEMPLATE/config.yml";
const REQUIRED_FILES = ["README.md", "PRIVACY.md", "SECURITY.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "docs/THREAT_MODEL.md", "docs/USER_GUIDE.md", ISSUE_CONFIG];
const LICENSE_FILES = ["LICENSE", "LICENSE.md", "COPYING"];

export function evaluateRelease({ tag, packageVersion, files, repositoryMetadataReady = true }) {
  const errors = [];
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) errors.push("Sürüm etiketi vMAJOR.MINOR.PATCH biçiminde olmalıdır");
  if (tag !== `v${packageVersion}`) errors.push(`Etiket (${tag}) package.json sürümüyle (v${packageVersion}) eşleşmiyor`);
  for (const file of REQUIRED_FILES) if (!files.has(file)) errors.push(`Zorunlu yayın dosyası eksik: ${file}`);
  if (!LICENSE_FILES.some(file => files.has(file))) errors.push("Açık kaynak lisansı eksik: LICENSE, LICENSE.md veya COPYING gerekli");
  if (!repositoryMetadataReady) errors.push("GitHub güvenlik bağlantısı ve bildirim metni gerçek depo bilgileriyle güncellenmelidir");
  return { ok: errors.length === 0, errors };
}

function main() {
  const tag = process.argv[2] ?? "";
  const packageJson = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const files = new Set([...REQUIRED_FILES, ...LICENSE_FILES].filter(file => existsSync(path.join(ROOT, file))));
  const issueConfig = files.has(ISSUE_CONFIG) ? readFileSync(path.join(ROOT, ISSUE_CONFIG), "utf8") : "";
  const securityPolicy = readFileSync(path.join(ROOT, "SECURITY.md"), "utf8");
  const repositoryMetadataReady = files.has(ISSUE_CONFIG) && !issueConfig.includes("OWNER/REPOSITORY") && !securityPolicy.includes("GitHub deposu yayımlandığında");
  const result = evaluateRelease({ tag, packageVersion: packageJson.version, files, repositoryMetadataReady });
  if (!result.ok) {
    console.error("Sürüm doğrulaması başarısız:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`${tag} sürüm kapıları hazır.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
