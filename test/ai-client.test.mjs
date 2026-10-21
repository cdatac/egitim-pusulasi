import test from "node:test";
import assert from "node:assert/strict";
import { requestAiJson } from "../lib/ai-client.mjs";

const configuration = {
  apiUrl: "http://127.0.0.1:11434/v1/responses",
  apiKey: "",
  model: "yerel-deneme"
};

test("AI istemcisi model ve girdiyi sınırlı JSON yanıtıyla işler", async () => {
  let received;
  const result = await requestAiJson(configuration, "örnek girdi", {
    fetchImpl: async (_url, options) => {
      received = JSON.parse(options.body);
      return new Response(JSON.stringify({ output_text: "tamam" }), { headers: { "content-type": "application/json" } });
    }
  });
  assert.deepEqual(received, { model: "yerel-deneme", input: "örnek girdi" });
  assert.deepEqual(result, { output_text: "tamam" });
});

test("bildirilen veya akışta gelen aşırı büyük AI yanıtını reddeder", async () => {
  await assert.rejects(() => requestAiJson(configuration, "x", {
    maximumBytes: 8,
    fetchImpl: async () => new Response("0123456789", { headers: { "content-length": "10" } })
  }), /bayt sınırını/);

  await assert.rejects(() => requestAiJson(configuration, "x", {
    maximumBytes: 8,
    fetchImpl: async () => new Response("0123456789")
  }), /bayt sınırını/);
});

test("yanıt vermeyen AI servisini zaman aşımıyla durdurur", async () => {
  const fetchImpl = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  });
  await assert.rejects(() => requestAiJson(configuration, "x", { fetchImpl, timeoutMs: 5 }), /zaman aşımına/);
});

test("geçersiz JSON ve servis hata gövdesini güvenli hata olarak döndürür", async () => {
  await assert.rejects(() => requestAiJson(configuration, "x", {
    fetchImpl: async () => new Response("JSON değil")
  }), /geçerli JSON/);
  await assert.rejects(() => requestAiJson(configuration, "x", {
    fetchImpl: async () => new Response("özel sağlayıcı hata ayrıntısı", { status: 503 })
  }), /503/);
});
