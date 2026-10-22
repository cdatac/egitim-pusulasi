import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildPortable } from "../scripts/build-portable.mjs";

test("taşınabilir paket yalnızca uygulama, çalışma zamanı ve lisans dosyalarını içerir", async t => {
  const temporary = await mkdtemp(path.join(tmpdir(), "egitim-pusulasi-portable-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const fakeNode = path.join(temporary, "node.exe");
  const fakeLicense = path.join(temporary, "NODE-LICENSE");
  const output = path.join(temporary, "package");
  await writeFile(fakeNode, "sentetik-node", "utf8");
  await writeFile(fakeLicense, "sentetik lisans - yalnızca paketleme testi", "utf8");

  const result = await buildPortable({
    outputDirectory: output,
    nodeBinary: fakeNode,
    nodeLicense: fakeLicense,
    platform: "win32",
    architecture: "x64",
    nodeVersion: "24.0.0-test"
  });

  assert.equal(result.manifest.dataIncluded, false);
  assert.equal(result.manifest.platform, "win32");
  assert.equal(typeof result.manifest.includesProjectLicense, "boolean");
  assert.equal(existsSync(path.join(output, "runtime", "node.exe")), true);
  assert.equal(existsSync(path.join(output, "runtime", "NODE-LICENSE")), true);
  assert.equal(existsSync(path.join(output, "app", "server.mjs")), true);
  assert.equal(existsSync(path.join(output, "app", "public", "index.html")), true);
  assert.equal(existsSync(path.join(output, "data")), false);
  assert.equal(existsSync(path.join(output, "app", "data")), false);
  assert.equal(existsSync(path.join(output, ".git")), false);
  assert.match(await readFile(path.join(output, "Egitim-Pusulasi-Baslat.cmd"), "utf8"), /runtime\\node\.exe/);
  assert.match(await readFile(path.join(output, "K12-Baglantisini-Ac.cmd"), "utf8"), /open-k12-browser\.mjs/);
});

test("var olan çıktı dizininin üzerine yazmaz", async t => {
  const temporary = await mkdtemp(path.join(tmpdir(), "egitim-pusulasi-portable-existing-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await assert.rejects(() => buildPortable({
    outputDirectory: temporary,
    nodeBinary: process.execPath,
    nodeLicense: import.meta.filename
  }), /zaten var/);
});
