import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRelease } from "../scripts/verify-release.mjs";

const required = new Set(["README.md", "PRIVACY.md", "SECURITY.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "docs/THREAT_MODEL.md", ".github/ISSUE_TEMPLATE/config.yml", "LICENSE"]);

test("eşleşen semver etiketi ve lisansla sürümü hazır kabul eder", () => {
  assert.deepEqual(evaluateRelease({ tag: "v0.1.0", packageVersion: "0.1.0", files: required }), { ok: true, errors: [] });
});

test("etiket-sürüm uyuşmazlığını ve eksik lisansı reddeder", () => {
  const files = new Set([...required].filter(file => file !== "LICENSE"));
  const result = evaluateRelease({ tag: "release-1", packageVersion: "0.1.0", files });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => /vMAJOR/.test(error)));
  assert.ok(result.errors.some(error => /eşleşmiyor/.test(error)));
  assert.ok(result.errors.some(error => /lisansı eksik/.test(error)));
});

test("zorunlu güvenlik ve topluluk belgelerinin her birini denetler", () => {
  const files = new Set(required);
  files.delete("SECURITY.md");
  const result = evaluateRelease({ tag: "v0.1.0", packageVersion: "0.1.0", files });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SECURITY\.md/);
});

test("örnek GitHub güvenlik bağlantısı ve geçici bildirim metniyle sürümü reddeder", () => {
  const result = evaluateRelease({
    tag: "v0.1.0",
    packageVersion: "0.1.0",
    files: required,
    repositoryMetadataReady: false
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => /gerçek depo bilgileri/.test(error)));
});
