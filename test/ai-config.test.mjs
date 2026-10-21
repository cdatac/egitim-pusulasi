import test from "node:test";
import assert from "node:assert/strict";
import { aiProviderName, aiRequestHeaders, inspectAiConfiguration } from "../lib/ai-config.mjs";

test("anahtarsız geri-döngü AI servisini yerel kabul eder", () => {
  const configuration = inspectAiConfiguration({
    AI_API_URL: "http://127.0.0.1:11434/v1/responses",
    AI_MODEL: "yerel-deneme"
  });
  assert.equal(configuration.configured, true);
  assert.equal(configuration.mode, "local");
  assert.deepEqual(aiRequestHeaders(configuration), { "content-type": "application/json" });
  assert.equal(aiProviderName(configuration, true), "yerel-model-maskeli");
});

test("anahtarsız uzak AI servisini reddeder", () => {
  const configuration = inspectAiConfiguration({
    AI_API_URL: "https://example.invalid/v1/responses",
    AI_MODEL: "uzak-deneme"
  });
  assert.equal(configuration.configured, false);
  assert.equal(configuration.mode, "incomplete");
  assert.match(configuration.errors.join(" "), /AI_API_KEY eksik/);
});

test("uzak AI anahtarını yalnızca Authorization başlığına koyar", () => {
  const configuration = inspectAiConfiguration({
    AI_API_URL: "https://example.invalid/v1/responses",
    AI_API_KEY: "test",
    AI_MODEL: "uzak-deneme"
  });
  assert.equal(configuration.configured, true);
  assert.equal(configuration.mode, "remote");
  assert.deepEqual(aiRequestHeaders(configuration), {
    "content-type": "application/json",
    authorization: "Bearer test"
  });
});

test("URL içine gömülü kullanıcı adı veya parolayı reddeder", () => {
  const configuration = inspectAiConfiguration({
    AI_API_URL: ["http://kullanici", ":parola@127.0.0.1:11434/v1/responses"].join(""),
    AI_MODEL: "yerel-deneme"
  });
  assert.equal(configuration.configured, false);
  assert.match(configuration.errors.join(" "), /kullanıcı adı veya parola/);
});
