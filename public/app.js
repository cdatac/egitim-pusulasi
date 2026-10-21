const $ = selector => document.querySelector(selector);
const feed = $("#feed");
let messages = [];
let aiConfigured = false;
let profiles = [];
let activeProfileId = null;
let currentDigest = null;

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function render() {
  if (!messages.length) {
    feed.replaceChildren($("#empty-template").content.cloneNode(true));
    return;
  }
  feed.innerHTML = messages.map(item => {
    const analysis = item.analysis;
    const dates = analysis?.dates?.map(date => `<span class="chip date">${esc(date.value)}</span>`).join("") ?? "";
    const tasks = analysis?.actionItems?.map(task => `<li class="${task.completed ? "completed" : ""}"><label><input class="task-toggle" type="checkbox" data-message-id="${item.id}" data-task-key="${esc(task.key)}" ${task.completed ? "checked" : ""}> <span>${esc(task.text)}</span></label></li>`).join("") ?? "";
    return `<article id="message-${item.id}" class="message ${analysis?.priority === "yüksek" ? "high" : ""}">
      <div class="message-head">
        <div><span class="chip">${esc(analysis?.category ?? item.kind)}</span>${analysis?.priority === "yüksek" ? `<span class="chip priority">Öncelikli</span>` : ""}${dates}</div>
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

function renderDigest() {
  const content = $("#digest-content");
  if (!currentDigest?.sourceCount) {
    content.innerHTML = `<p class="digest-empty">Bu dönemde alınan ileti yok.</p><small>${esc(currentDigest?.note ?? "")}</small>`;
    return;
  }
  const categories = currentDigest.categories.map(item => `<span class="chip">${esc(item.category)} · ${item.count}</span>`).join("");
  const items = currentDigest.items.map(item => {
    const tasks = item.openTaskCount ? `${item.openTaskCount} açık görev` : "Açık görev yok";
    const dates = item.dates.map(date => esc(date.value)).join(", ");
    return `<a class="digest-item" href="#message-${item.messageId}" data-message-id="${item.messageId}">
      <span><strong>${esc(item.title)}</strong><small>${esc(item.category)} · ${tasks}${dates ? ` · ${dates}` : ""}</small></span>
      <span aria-hidden="true">Kaynağa git →</span>
    </a>`;
  }).join("");
  content.innerHTML = `<div class="digest-counts">
      <span><strong>${currentDigest.sourceCount}</strong> ileti</span>
      <span><strong>${currentDigest.urgentCount}</strong> öncelikli</span>
      <span><strong>${currentDigest.taskCount}</strong> açık görev</span>
    </div>
    <div class="digest-categories">${categories}</div>
    <div class="digest-items">${items}</div>
    <small>${esc(currentDigest.note)}</small>`;
}

async function refresh(q = "") {
  if (!activeProfileId) return;
  const profile = `profileId=${encodeURIComponent(activeProfileId)}`;
  const period = $("#digest-period").value;
  const [health, dashboard, list, digest] = await Promise.all([
    fetch("/api/health").then(r => r.json()),
    fetch(`/api/dashboard?${profile}`).then(r => r.json()),
    fetch(`/api/messages?${profile}&q=${encodeURIComponent(q)}`).then(r => r.json()),
    fetch(`/api/digest?${profile}&period=${encodeURIComponent(period)}`).then(r => r.json())
  ]);
  aiConfigured = health.aiConfigured;
  $("#ai-state").textContent = health.aiConfigured ? "AI hazır · onaylı" : "Yerel analiz";
  $("#total").textContent = dashboard.total;
  $("#urgent").textContent = dashboard.urgent;
  $("#tasks").textContent = dashboard.taskCount;
  messages = list;
  currentDigest = digest;
  $("#digest-title").textContent = digest.label;
  renderDigest();
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

$("#digest-period").addEventListener("change", () => refresh($("#search").value));

$("#digest-content").addEventListener("click", async event => {
  const link = event.target.closest(".digest-item");
  if (!link) return;
  event.preventDefault();
  const targetId = `message-${link.dataset.messageId}`;
  if (!document.getElementById(targetId)) {
    $("#search").value = "";
    await refresh();
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(targetId)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
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

$("#redactions").addEventListener("click", async () => {
  const currentResponse = await fetch(`/api/profiles/${activeProfileId}/redactions`);
  const current = await currentResponse.json();
  if (!currentResponse.ok) return alert(current.error ?? "Maskeleme listesi alınamadı.");
  const input = prompt("AI çağrısından önce maskelenecek ad veya ifadeleri virgül ya da yeni satırla ayırın. Liste yalnızca bu cihazda tutulur:", current.terms.join(", "));
  if (input === null) return;
  const terms = input.split(/[,\n]+/).map(value => value.trim()).filter(Boolean);
  const response = await fetch(`/api/profiles/${activeProfileId}/redactions`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ terms })
  });
  const result = await response.json();
  if (!response.ok) return alert(result.error ?? "Maskeleme listesi kaydedilemedi.");
  alert(`${result.terms.length} özel maskeleme ifadesi yalnızca bu cihazda kaydedildi.`);
});

feed.addEventListener("click", async event => {
  const taskToggle = event.target.closest(".task-toggle");
  if (taskToggle) {
    taskToggle.disabled = true;
    const response = await fetch(`/api/messages/${taskToggle.dataset.messageId}/tasks/${taskToggle.dataset.taskKey}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ completed: taskToggle.checked })
    });
    if (!response.ok) alert("Görev durumu kaydedilemedi.");
    await refresh($("#search").value);
    return;
  }
  const aiButton = event.target.closest(".ai-message");
  if (aiButton) {
    const previewResponse = await fetch(`/api/messages/${aiButton.dataset.id}/ai-preview`);
    const preview = await previewResponse.json();
    if (!previewResponse.ok) return alert(preview.error ?? "AI önizlemesi alınamadı.");
    const masking = preview.redactionEnabled
      ? `E-posta ve telefon maskelemesi açık. ${preview.customRedactionTerms} özel ifade de maskelenecek.`
      : "Maskeleme kapalı.";
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

$("#calendar").addEventListener("click", async () => {
  const response = await fetch(`/api/calendar.ics?profileId=${encodeURIComponent(activeProfileId)}`);
  if (!response.ok) return alert("Takvim dışa aktarılamadı.");
  const eventCount = Number(response.headers.get("x-calendar-events") ?? 0);
  const omitted = Number(response.headers.get("x-calendar-omitted-dates") ?? 0);
  if (!eventCount) return alert("Takvime eklenebilecek, yılı açıkça yazılmış sayısal bir tarih bulunamadı.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `egitim-pusulasi-takvim-${new Date().toISOString().slice(0, 10)}.ics`;
  link.click();
  URL.revokeObjectURL(url);
  if (omitted) alert(`${eventCount} takvim olayı indirildi. Tahmin yapılmaması için ${omitted} belirsiz veya yılı eksik tarih takvime eklenmedi.`);
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
