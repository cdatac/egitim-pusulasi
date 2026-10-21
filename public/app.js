const $ = selector => document.querySelector(selector);
const feed = $("#feed");
let messages = [];
let aiConfigured = false;
let profiles = [];
let activeProfileId = null;

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function render() {
  if (!messages.length) {
    feed.replaceChildren($("#empty-template").content.cloneNode(true));
    $("#tasks").textContent = "0";
    return;
  }
  const taskCount = messages.reduce((sum, item) => sum + (item.analysis?.actionItems?.length ?? 0), 0);
  $("#tasks").textContent = taskCount;
  feed.innerHTML = messages.map(item => {
    const analysis = item.analysis;
    const dates = analysis?.dates?.map(date => `<span class="chip date">${esc(date.value)}</span>`).join("") ?? "";
    const tasks = analysis?.actionItems?.map(task => `<li>${esc(task.text)}</li>`).join("") ?? "";
    return `<article class="message ${analysis?.priority === "yüksek" ? "high" : ""}">
      <div class="message-head">
        <div><span class="chip">${esc(analysis?.category ?? item.kind)}</span>${dates}</div>
        <small>${esc(item.occurredAt || item.createdAt)}</small>
      </div>
      <h3>${esc(item.title)}</h3>
      <p class="summary">${esc(analysis?.summary ?? item.body)}</p>
      ${tasks ? `<div class="actions"><strong>Yapılacaklar</strong><ul>${tasks}</ul></div>` : ""}
      <details><summary>Kaynak iletiyi göster</summary><p>${esc(item.body)}</p><small>${esc(item.sender ?? "Kaynak belirtilmedi")} · ${esc(analysis?.provider ?? "işlenmedi")}</small></details>
      <div class="message-controls">
        ${aiConfigured ? `<button class="ai-message" data-id="${item.id}">AI ile analiz et</button>` : ""}
        <button class="delete-message" data-id="${item.id}" aria-label="${esc(item.title)} iletisini sil">İletiyi sil</button>
      </div>
    </article>`;
  }).join("");
}

async function refresh(q = "") {
  if (!activeProfileId) return;
  const profile = `profileId=${encodeURIComponent(activeProfileId)}`;
  const [health, dashboard, list] = await Promise.all([
    fetch("/api/health").then(r => r.json()),
    fetch(`/api/dashboard?${profile}`).then(r => r.json()),
    fetch(`/api/messages?${profile}&q=${encodeURIComponent(q)}`).then(r => r.json())
  ]);
  aiConfigured = health.aiConfigured;
  $("#ai-state").textContent = health.aiConfigured ? "AI hazır · onaylı" : "Yerel analiz";
  $("#total").textContent = dashboard.total;
  $("#urgent").textContent = dashboard.urgent;
  messages = list;
  render();
}

async function loadProfiles() {
  profiles = await fetch("/api/profiles").then(response => response.json());
  const saved = Number(localStorage.getItem("egitim-pusulasi-profile"));
  activeProfileId = profiles.some(profile => profile.id === saved) ? saved : profiles[0]?.id;
  const select = $("#profile-select");
  select.innerHTML = profiles.map(profile => `<option value="${profile.id}">${esc(profile.name)}</option>`).join("");
  select.value = String(activeProfileId ?? "");
}

function parseImport(text) {
  return text.split(/^---+$/m).map(block => block.trim()).filter(Boolean).map((block, index) => {
    const lines = block.split(/\r?\n/);
    return { source: "manual", externalId: `manual-${Date.now()}-${index}`, title: lines.shift()?.trim() || "Başlıksız", body: lines.join("\n").trim() || block };
  });
}

$("#import").addEventListener("click", async () => {
  const items = parseImport($("#import-text").value);
  if (!items.length) return;
  $("#feedback").textContent = "İşleniyor…";
  const scopedItems = items.map(item => ({ ...item, profileId: activeProfileId }));
  const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items: scopedItems }) });
  const result = await response.json();
  $("#feedback").textContent = response.ok ? `${result.imported} ileti eklendi` : result.error;
  if (response.ok) $("#import-text").value = "";
  await refresh();
});

$("#demo").addEventListener("click", () => {
  $("#import-text").value = `Fen Bilimleri Projesi\nÖğrencilerimizin 23.10.2026 Cuma gününe kadar projelerini teslim etmeleri gerekmektedir. Karton, pil ve LED getiriniz.\n---\nVeli Toplantısı\nÖnemli: Yarın saat 18.30'da çevrim içi veli toplantısı yapılacaktır.`;
});

let timer;
$("#search").addEventListener("input", event => {
  clearTimeout(timer);
  timer = setTimeout(() => refresh(event.target.value), 180);
});

$("#profile-select").addEventListener("change", async event => {
  activeProfileId = Number(event.target.value);
  localStorage.setItem("egitim-pusulasi-profile", String(activeProfileId));
  await refresh($("#search").value);
});

$("#add-profile").addEventListener("click", async () => {
  const name = prompt("Çocuk için yerel bir ad veya takma ad girin:");
  if (!name?.trim()) return;
  const response = await fetch("/api/profiles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: name.trim() })
  });
  const profile = await response.json();
  if (!response.ok) return alert(profile.error ?? "Profil oluşturulamadı.");
  await loadProfiles();
  activeProfileId = profile.id;
  $("#profile-select").value = String(profile.id);
  localStorage.setItem("egitim-pusulasi-profile", String(profile.id));
  await refresh();
});

feed.addEventListener("click", async event => {
  const aiButton = event.target.closest(".ai-message");
  if (aiButton) {
    const previewResponse = await fetch(`/api/messages/${aiButton.dataset.id}/ai-preview`);
    const preview = await previewResponse.json();
    if (!previewResponse.ok) return alert(preview.error ?? "AI önizlemesi alınamadı.");
    const masking = preview.redactionEnabled ? "E-posta ve telefon maskelemesi açık." : "Maskeleme kapalı.";
    const accepted = confirm(`Başlık, gönderen, tarih ve mesaj gövdesi seçtiğiniz AI servisine gönderilecek. ${masking}\n\nYaklaşık ${preview.characters} karakter gönderilecek. Devam edilsin mi?`);
    if (!accepted) return;
    aiButton.disabled = true;
    aiButton.textContent = "AI işliyor…";
    const response = await fetch(`/api/messages/${aiButton.dataset.id}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "cloud" })
    });
    const result = await response.json();
    if (!response.ok) alert(result.error ?? "AI analizi başarısız oldu.");
    await refresh($("#search").value);
    return;
  }
  const button = event.target.closest(".delete-message");
  if (!button) return;
  if (!confirm("Bu ileti ve analizi kalıcı olarak silinsin mi?")) return;
  const response = await fetch(`/api/messages/${button.dataset.id}`, { method: "DELETE" });
  if (!response.ok) return alert("İleti silinemedi.");
  await refresh($("#search").value);
});

$("#export").addEventListener("click", async () => {
  const response = await fetch("/api/export");
  if (!response.ok) return alert("Veri dışa aktarılamadı.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `egitim-pusulasi-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

$("#clear").addEventListener("click", async () => {
  const profileName = profiles.find(profile => profile.id === activeProfileId)?.name ?? "bu profil";
  if (!confirm(`${profileName} için tüm yerel mesajlar ve analizler kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
  const response = await fetch(`/api/messages?profileId=${encodeURIComponent(activeProfileId)}`, { method: "DELETE" });
  if (!response.ok) return alert("Veriler temizlenemedi.");
  await refresh();
});

loadProfiles().then(() => refresh()).catch(error => {
  feed.innerHTML = `<div class="empty"><strong>Bağlantı kurulamadı.</strong><span>${esc(error.message)}</span></div>`;
});
