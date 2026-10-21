import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const gitPrefix = ["-c", `safe.directory=${root.replaceAll("\\", "/")}`];
const findings = new Set();
let inspectedBlobs = 0;

function git(args, options = {}) {
  return execFileSync("git", [...gitPrefix, ...args], {
    cwd: root,
    encoding: options.encoding ?? "utf8",
    maxBuffer: 64 * 1024 * 1024
  });
}

function normalize(file) {
  return file.replaceAll("\\", "/");
}

function inspectPath(file, location) {
  const normalized = normalize(file);
  const forbidden = [
    /(^|\/)data(\/|$)/i,
    /(^|\/)work(\/|$)/i,
    /(^|\/)K12_REA_DEGERLENDIRME\.md$/i,
    /\.(?:apk|apks|aab|db|db-shm|db-wal|har|saz|pcap|pem|key)$/i,
    /(^|\/)\.env(?:\..+)?$/i
  ];
  if (normalized === ".env.example") return;
  if (forbidden.some(pattern => pattern.test(normalized))) {
    findings.add(`${location}: özel veya üretilmiş dosya izleniyor: ${normalized}`);
  }
}

const secretPatterns = [
  ["AWS erişim anahtarı", /\bAKIA[0-9A-Z]{16}\b/g],
  ["GitHub erişim belirteci", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ["AI API anahtarı", /\bsk-[A-Za-z0-9_-]{32,}\b/g],
  ["JWT", /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g],
  ["kimlik bilgili URL", /https?:\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/gi],
  ["atanmış kimlik bilgisi", /\b(?:password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookie)\b\s*[:=]\s*["'][^"']{12,}["']/gi],
  ["özel anahtar", new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?PRIVATE KEY-----"].join(""), "g")]
];

function inspectContent(file, buffer, location) {
  if (buffer.length > 1024 * 1024 || buffer.includes(0)) return;
  let text = buffer.toString("utf8");
  // Depoda sır reddetme davranışını kanıtlayan, açıkça sentetik eski test
  // değerleri bulunur. Gerçek sırlara benzeyen genel bir muafiyet verilmez.
  text = text
    .replaceAll(["asla", "-kabul-etme"].join(""), "x")
    .replaceAll(["user", ":pass@"].join(""), "test-user@");
  for (const [name, pattern] of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) findings.add(`${location}: ${file} içinde olası ${name}`);
  }
}

function inspectWorkingTree() {
  const files = git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]).split("\0").filter(Boolean);
  for (const file of files) {
    inspectPath(file, "çalışma ağacı");
    inspectContent(file, readFileSync(path.join(root, file)), "çalışma ağacı");
  }
  return files.length;
}

function inspectHistory() {
  const commits = git(["rev-list", "--all"]).trim().split(/\r?\n/).filter(Boolean);
  const seen = new Set();
  for (const commit of commits) {
    const entries = git(["ls-tree", "-r", "-z", "--full-tree", commit]).split("\0").filter(Boolean);
    for (const entry of entries) {
      const match = entry.match(/^\d+ blob ([0-9a-f]+)\t(.+)$/s);
      if (!match) continue;
      const [, blob, file] = match;
      inspectPath(file, `geçmiş ${commit.slice(0, 8)}`);
      const key = `${blob}:${file}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const size = Number(git(["cat-file", "-s", blob]).trim());
      if (size <= 1024 * 1024) {
        const content = git(["cat-file", "blob", blob], { encoding: "buffer" });
        inspectContent(file, content, `geçmiş ${commit.slice(0, 8)}`);
      }
      inspectedBlobs += 1;
    }
  }
  return commits.length;
}

try {
  const trackedFiles = inspectWorkingTree();
  const commits = inspectHistory();
  if (findings.size) {
    console.error("Yayın denetimi başarısız:\n");
    for (const finding of [...findings].sort()) console.error(`- ${finding}`);
    process.exitCode = 1;
  } else {
    console.log(`Yayın denetimi temiz: ${trackedFiles} izlenen dosya, ${commits} commit, ${inspectedBlobs} geçmiş blob incelendi.`);
  }
} catch (error) {
  console.error(`Yayın denetimi çalıştırılamadı: ${error.message}`);
  process.exitCode = 1;
}
