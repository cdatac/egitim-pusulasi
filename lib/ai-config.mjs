const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

function clean(value) {
  return String(value ?? "").trim();
}

export function inspectAiConfiguration(env = process.env) {
  const apiUrl = clean(env.AI_API_URL);
  const apiKey = clean(env.AI_API_KEY);
  const model = clean(env.AI_MODEL);
  const anyConfigured = Boolean(apiUrl || apiKey || model);
  const errors = [];
  let parsedUrl = null;

  if (apiUrl) {
    try {
      parsedUrl = new URL(apiUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        errors.push("AI_API_URL yalnızca http veya https olabilir");
        parsedUrl = null;
      } else if (parsedUrl.username || parsedUrl.password) {
        errors.push("AI_API_URL kullanıcı adı veya parola içeremez");
      }
    } catch {
      errors.push("AI_API_URL geçerli bir URL değil");
    }
  }

  const localService = Boolean(parsedUrl && LOOPBACK_HOSTS.has(parsedUrl.hostname.toLowerCase()));
  if (anyConfigured) {
    if (!apiUrl) errors.push("AI yapılandırması yarım: AI_API_URL eksik");
    if (!model) errors.push("AI yapılandırması yarım: AI_MODEL eksik");
    if (parsedUrl && !localService && !apiKey) errors.push("Uzak AI servisi için AI_API_KEY eksik");
  }

  const configured = anyConfigured && errors.length === 0;
  return {
    configured,
    mode: configured ? (localService ? "local" : "remote") : (anyConfigured ? "incomplete" : "disabled"),
    apiUrl,
    apiKey,
    model,
    localService,
    errors
  };
}

export function aiRequestHeaders(configuration) {
  const headers = { "content-type": "application/json" };
  if (configuration.apiKey) headers.authorization = `Bearer ${configuration.apiKey}`;
  return headers;
}

export function aiProviderName(configuration, redactionEnabled) {
  const base = configuration.mode === "local" ? "yerel-model" : "yapay-zeka";
  return redactionEnabled ? `${base}-maskeli` : base;
}
