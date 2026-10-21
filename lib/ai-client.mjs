import { Buffer } from "node:buffer";
import { aiRequestHeaders } from "./ai-config.mjs";

export const AI_TIMEOUT_MS = 30_000;
export const AI_MAX_RESPONSE_BYTES = 1_000_000;

async function limitedResponseText(response, maximumBytes) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error(`AI yanıtı ${maximumBytes} bayt sınırını aşıyor`);
  }

  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maximumBytes) throw new Error(`AI yanıtı ${maximumBytes} bayt sınırını aşıyor`);
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new Error(`AI yanıtı ${maximumBytes} bayt sınırını aşıyor`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

export async function requestAiJson(configuration, input, {
  fetchImpl = fetch,
  timeoutMs = AI_TIMEOUT_MS,
  maximumBytes = AI_MAX_RESPONSE_BYTES
} = {}) {
  let response;
  try {
    response = await fetchImpl(configuration.apiUrl, {
      method: "POST",
      headers: aiRequestHeaders(configuration),
      body: JSON.stringify({ model: configuration.model, input }),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") throw new Error("AI servisi zaman aşımına uğradı");
    throw new Error(`AI servisine erişilemedi: ${error?.message ?? "bilinmeyen hata"}`);
  }
  if (!response.ok) throw new Error(`AI servisi ${response.status} döndürdü`);

  let text;
  try {
    text = await limitedResponseText(response, maximumBytes);
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") throw new Error("AI servisi zaman aşımına uğradı");
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("AI servisi geçerli JSON döndürmedi");
  }
}
