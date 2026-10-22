import { createHash } from "node:crypto";
import { chmod, copyFile, cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP_FILES = [
  ".env.example",
  "CHANGELOG.md",
  "README.md",
  "PRIVACY.md",
  "SECURITY.md",
  "package.json",
  "server.mjs",
  "lib",
  "public",
  "docs/INSTALL.md",
  "docs/USER_GUIDE.md",
  "scripts/doctor.mjs",
  "scripts/launch.mjs",
  "scripts/open-k12-browser.mjs"
];

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function launcher(platform) {
  if (platform === "win32") {
    return [
      "@echo off",
      "setlocal",
      "set \"ROOT=%~dp0\"",
      "\"%ROOT%runtime\\node.exe\" \"%ROOT%app\\scripts\\launch.mjs\"",
      "endlocal",
      ""
    ].join("\r\n");
  }
  return [
    "#!/bin/sh",
    "set -eu",
    "ROOT=$(CDPATH= cd -- \"$(dirname -- \"$0\")\" && pwd)",
    "exec \"$ROOT/runtime/node\" \"$ROOT/app/scripts/launch.mjs\" \"$@\"",
    ""
  ].join("\n");
}

function k12Launcher(platform) {
  if (platform === "win32") {
    return [
      "@echo off",
      "setlocal",
      "set \"ROOT=%~dp0\"",
      "\"%ROOT%runtime\\node.exe\" \"%ROOT%app\\scripts\\open-k12-browser.mjs\"",
      "if errorlevel 1 pause",
      "endlocal",
      ""
    ].join("\r\n");
  }
  return [
    "#!/bin/sh",
    "set -eu",
    "ROOT=$(CDPATH= cd -- \"$(dirname -- \"$0\")\" && pwd)",
    "exec \"$ROOT/runtime/node\" \"$ROOT/app/scripts/open-k12-browser.mjs\" \"$@\"",
    ""
  ].join("\n");
}

export async function buildPortable({
  outputDirectory,
  nodeBinary,
  nodeLicense,
  platform = process.platform,
  architecture = process.arch,
  nodeVersion = process.versions.node,
  root = ROOT
}) {
  if (!outputDirectory || !nodeBinary || !nodeLicense) throw new Error("outputDirectory, nodeBinary ve nodeLicense zorunludur");
  if (!new Set(["win32", "linux", "darwin"]).has(platform)) throw new Error(`Desteklenmeyen platform: ${platform}`);
  const output = path.resolve(outputDirectory);
  if (existsSync(output)) throw new Error(`Paket dizini zaten var: ${output}`);

  const nodeInfo = await stat(nodeBinary);
  const licenseInfo = await stat(nodeLicense);
  if (!nodeInfo.isFile() || nodeInfo.size < 1) throw new Error("Node çalışma zamanı dosyası geçersiz");
  if (!licenseInfo.isFile() || licenseInfo.size < 1) throw new Error("Node lisans dosyası geçersiz");

  const appDirectory = path.join(output, "app");
  const runtimeDirectory = path.join(output, "runtime");
  await mkdir(appDirectory, { recursive: true });
  await mkdir(runtimeDirectory, { recursive: true });
  for (const relative of APP_FILES) {
    const source = path.join(root, relative);
    if (!existsSync(source)) throw new Error(`Paket kaynak dosyası eksik: ${relative}`);
    const destination = path.join(appDirectory, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true });
  }

  const runtimeName = platform === "win32" ? "node.exe" : "node";
  const runtimePath = path.join(runtimeDirectory, runtimeName);
  await copyFile(nodeBinary, runtimePath);
  await copyFile(nodeLicense, path.join(runtimeDirectory, "NODE-LICENSE"));
  if (platform !== "win32") await chmod(runtimePath, 0o755);

  const launcherName = platform === "win32" ? "Egitim-Pusulasi-Baslat.cmd" : "egitim-pusulasi";
  const launcherPath = path.join(output, launcherName);
  await writeFile(launcherPath, launcher(platform), "utf8");
  if (platform !== "win32") await chmod(launcherPath, 0o755);
  const k12LauncherName = platform === "win32" ? "K12-Baglantisini-Ac.cmd" : "k12-baglantisini-ac";
  const k12LauncherPath = path.join(output, k12LauncherName);
  await writeFile(k12LauncherPath, k12Launcher(platform), "utf8");
  if (platform !== "win32") await chmod(k12LauncherPath, 0o755);

  if (existsSync(path.join(root, "LICENSE"))) await copyFile(path.join(root, "LICENSE"), path.join(output, "LICENSE"));
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const runtimeBytes = await readFile(runtimePath);
  const manifest = {
    product: "Eğitim Pusulası",
    version: packageJson.version,
    platform,
    architecture,
    nodeVersion,
    nodeSha256: sha256(runtimeBytes),
    includesProjectLicense: existsSync(path.join(root, "LICENSE")),
    dataIncluded: false
  };
  await writeFile(path.join(output, "portable-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { output, launcherPath, runtimePath, manifest };
}

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const result = await buildPortable({
    outputDirectory: argument("output"),
    nodeBinary: argument("node"),
    nodeLicense: argument("node-license"),
    platform: argument("platform") || process.platform,
    architecture: argument("arch") || process.arch
  });
  console.log(`Taşınabilir paket hazır: ${result.output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(`Taşınabilir paket oluşturulamadı: ${error.message}`);
    process.exitCode = 1;
  });
}
