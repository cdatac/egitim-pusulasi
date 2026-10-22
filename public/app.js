import { MAX_NOTIFICATION_EXPORT_BYTES, parseNotificationExportText } from "./import-utils.js";

const $ = selector => document.querySelector(selector);
const feed = $("#feed");
let messages = [];
let aiConfigured = false;
let profiles = [];
let activeProfileId = null;
let currentDigest = null;
let weeklyLearning = null;

function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function plain(value = "") {
  return String(value)
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>?/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return plain(value);
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function setView(view) {
  document.querySelectorAll("[data-view-section]").forEach(section => { section.hidden = section.dataset.viewSection !== view; });
  document.querySelectorAll(".tab-button").forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  localStorage.setItem("egitim-pusulasi-view", view);
}

function render() {
  if (!messages.length) {
    feed.replaceChildren($("#empty-template").content.cloneNode(true));
    return;
  }
  feed.innerHTML = messages.map(item => {
    const analysis = item.analysis;
    const dates = analysis?.dates?.map(date => `<span class="chip date">${esc(date.value)}</span>`).join("") ?? "";
    const tasks = analysis?.actionItems?.map(task => `<li class="${task.completed ? "completed" : ""}"><label><input class="task-toggle" type="checkbox" data-message-id="${item.id}" data-task-key="${esc(task.key)}" ${task.completed ? "checked" : ""}> <span>${esc(plain(task.text))}</span></label></li>`).join("") ?? "";
    return `<article id="message-${item.id}" class="message ${analysis?.priority === "yüksek" ? "high" : ""}">
      <div class="message-head">
        <div><span class="chip">${esc(analysis?.category ?? item.kind)}</span>${analysis?.priority === "yüksek" ? `<span class="chip priority">Öncelikli</span>` : ""}${dates}</div>
        <small>${esc(formatDate(item.occurredAt || item.createdAt))}</small>
      </div>
      <h3>${esc(plain(item.title))}</h3>
      <p class="summary">${esc(plain(analysis?.summary ?? item.body))}</p>
      ${tasks ? `<div class="actions"><strong>Yapılacaklar</strong><ul>${tasks}</ul></div>` : ""}
      <details><summary>Kaynak iletiyi göster</summary><p>${esc(plain(item.body))}</p><small>${esc(plain(item.sender ?? "Kaynak belirtilmedi"))} · ${esc(analysis?.provider ?? "işlenmedi")}</small></details>
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

function renderWeeklyLearning() {
  const content = $("#weekly-learning-content");
  if (!weeklyLearning?.sourceCount) {
    content.innerHTML = `<p class="digest-empty">Bu haftaya ait okul iletisi bulunamadı.</p><small>Başka bir hafta seçebilir veya K12 eşitlemesini yenileyebilirsiniz.</small>`;
    return;
  }
  const progress = weeklyLearning.progress;
  const summary = `<div class="weekly-summary">
    <span><strong>${weeklyLearning.learnings.length}</strong> kaynak kazanım/konu</span>
    <span><strong>${progress.totalTasks}</strong> ödev ve yapılacak</span>
    <span><strong>${progress.completedTasks}/${progress.totalTasks}</strong> tamamlandı</span>
    <span><strong>${progress.needsReview}</strong> eşleşmesi kontrol edilecek</span>
  </div>`;
  const subjects = weeklyLearning.subjects.map(group => {
    const learnings = group.learnings.length
      ? `<ul>${group.learnings.map(item => `<li>${esc(plain(item.text))} <a href="#message-${item.messageId}">#${item.messageId}</a></li>`).join("")}</ul>`
      : `<p class="digest-empty">Bu ders için açık kazanım ifadesi bulunamadı.</p>`;
    const tasks = group.tasks.length
      ? `<ul>${group.tasks.map(task => {
          const note = task.match.learning
            ? `${task.match.status}: ${task.match.learning.text}`
            : "Kazanımla eşleşmesi kullanıcı tarafından kontrol edilmeli";
          const checkbox = task.taskKey
            ? `<input class="weekly-task-toggle" type="checkbox" data-message-id="${task.messageId}" data-task-key="${esc(task.taskKey)}" ${task.completed ? "checked" : ""}>`
            : `<input type="checkbox" disabled title="Kaynak iletide ayrı bir görev olarak işaretlenmemiş">`;
          return `<li><label class="weekly-task ${task.completed ? "completed" : ""}">${checkbox}<span>${esc(plain(task.text))}<small class="match-note ${task.match.status === "eşleşti" ? "" : "review"}">${esc(plain(note))} · <a href="#message-${task.messageId}">kaynak #${task.messageId}</a></small></span></label></li>`;
        }).join("")}</ul>`
      : `<p class="digest-empty">Bu ders için ödev bulunamadı.</p>`;
    return `<article class="weekly-subject"><h3>${esc(group.subject)}</h3><div class="weekly-columns"><div><h4>Kazanım ve konular</h4>${learnings}</div><div><h4>Ödev kontrolü</h4>${tasks}</div></div></article>`;
  }).join("");
  const activities = weeklyLearning.activities.length
    ? `<div class="weekly-activities"><h3>Etkinlikler</h3><ul>${weeklyLearning.activities.map(item => `<li>${esc(plain(item.title))} · ${esc(plain(item.summary))} <a href="#message-${item.messageId}">#${item.messageId}</a></li>`).join("")}</ul></div>`
    : "";
  content.innerHTML = `${summary}<div class="weekly-subjects">${subjects || `<p class="digest-empty">Kaynak iletilerde ayrıştırılabilir ders veya ödev bulunamadı.</p>`}</div>${activities}<small class="weekly-method">${esc(weeklyLearning.methodology)}</small>`;
}

async function refresh(q = "") {
  if (!activeProfileId) return;
  const profile = `profileId=${encodeURIComponent(activeProfileId)}`;
  const period = $("#digest-period").value;
  const anchor = $("#weekly-anchor").value;
  const [health, dashboard, list, digest, weekly] = await Promise.all([
    fetch("/api/health").then(r => r.json()),
    fetch(`/api/dashboard?${profile}`).then(r => r.json()),
    fetch(`/api/messages?${profile}&q=${encodeURIComponent(q)}`).then(r => r.json()),
    fetch(`/api/digest?${profile}&period=${encodeURIComponent(period)}`).then(r => r.json()),
    fetch(`/api/weekly-learning?${profile}&anchor=${encodeURIComponent(anchor)}`).then(r => r.json())
  ]);
  aiConfigured = health.aiConfigured;
  $("#ai-state").textContent = health.aiConfigured
    ? `${health.aiMode === "local" ? "Yerel model" : "Uzak AI"} hazır · onaylı`
    : "Yerel kural analizi";
  $("#qa-ask").disabled = !health.aiConfigured;
  $("#qa-ask").title = health.aiConfigured ? "" : "Soru-cevap için isteğe bağlı AI servisi yapılandırılmalıdır";
  $("#total").textContent = dashboard.total;
  $("#urgent").textContent = dashboard.urgent;
  $("#tasks").textContent = dashboard.taskCount;
  messages = list;
  currentDigest = digest;
  weeklyLearning = weekly;
  $("#digest-title").textContent = digest.label;
  renderDigest();
  renderWeeklyLearning();
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

async function refreshK12Status() {
  const button = $("#k12-sync");
  const statusBox = $("#k12-sync-status");
  button.disabled = true;
  statusBox.textContent = "K12 bağlantısı kontrol ediliyor…";
  try {
    const response = await fetch("/api/connectors/k12/status");
    const status = await response.json();
    if (status.available && status.loggedIn) {
      statusBox.textContent = "K12 veli oturumu hazır. Mesaj ve duyurular eşitlenebilir.";
      button.disabled = false;
    } else if (status.available) {
      statusBox.textContent = "K12 sekmesi bulundu; önce o pencerede veli hesabına giriş yapın.";
    } else {
      statusBox.textContent = status.error ?? "K12 için açılmış Chrome penceresi bulunamadı.";
    }
  } catch {
    statusBox.textContent = "K12 bağlantısı kontrol edilemedi.";
  }
}

$("#k12-status-refresh").addEventListener("click", refreshK12Status);

$("#k12-sync").addEventListener("click", async () => {
  const button = $("#k12-sync");
  const statusBox = $("#k12-sync-status");
  const accepted = confirm("Açık K12 veli oturumundaki en fazla 250 mesaj ve duyuru bu çocuk profiline okunup yalnızca bu bilgisayarda saklanacak. K12'ye mesaj gönderilmeyecek ve hiçbir kayıt değiştirilmeyecek. Devam edilsin mi?");
  if (!accepted) return;
  button.disabled = true;
  statusBox.textContent = "K12 mesaj ve duyuruları okunuyor… Bu işlem biraz sürebilir.";
  try {
    const response = await fetch("/api/connectors/k12/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: activeProfileId, consent: true })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "K12 eşitlemesi başarısız oldu.");
    statusBox.textContent = `${result.scanned} K12 kaydı tarandı; ${result.imported} yeni kayıt eklendi, ${result.unchanged} kayıt zaten vardı.`;
    await refresh();
  } catch (error) {
    statusBox.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

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

$("#notification-file-button").addEventListener("click", () => $("#notification-file").click());

$("#notification-file").addEventListener("change", async event => {
  const [file] = event.target.files;
  if (!file) return;
  const feedback = $("#feedback");
  try {
    if (file.size > MAX_NOTIFICATION_EXPORT_BYTES) throw new Error("Bildirim dosyası en fazla 1 MB olabilir.");
    const records = parseNotificationExportText(await file.text());
    feedback.textContent = "Bildirimler güvenli biçimde içe aktarılıyor…";
    const response = await fetch("/api/connectors/k12/notifications/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ profileId: activeProfileId, records })
    });
    const result = await response.json();
    feedback.textContent = response.ok ? `${result.imported} K12 bildirimi eklendi` : result.error;
    if (response.ok) await refresh();
  } catch (error) {
    feedback.textContent = error instanceof SyntaxError ? "Bildirim dosyası geçerli JSON değil." : error.message;
  } finally {
    event.target.value = "";
  }
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

document.querySelectorAll(".tab-button,.open-view").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));

$("#weekly-anchor").addEventListener("change", () => refresh($("#search").value));

$("#weekly-learning-content").addEventListener("change", async event => {
  const task = event.target.closest(".weekly-task-toggle");
  if (!task) return;
  task.disabled = true;
  const response = await fetch(`/api/messages/${task.dataset.messageId}/tasks/${task.dataset.taskKey}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ completed: task.checked })
  });
  if (!response.ok) alert("Ödev kontrol durumu kaydedilemedi.");
  await refresh($("#search").value);
});

$("#weekly-calendar").addEventListener("click", async () => {
  const anchor = $("#weekly-anchor").value;
  const response = await fetch(`/api/weekly-learning.ics?profileId=${encodeURIComponent(activeProfileId)}&anchor=${encodeURIComponent(anchor)}`);
  if (!response.ok) return alert("Haftalık plan dışa aktarılamadı.");
  const events = Number(response.headers.get("x-calendar-events") ?? 0);
  const tasks = Number(response.headers.get("x-calendar-tasks") ?? 0);
  if (!events && !tasks) return alert("Bu haftada dışa aktarılabilecek tarih veya yapılacak bulunamadı.");
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `egitim-pusulasi-haftalik-${anchor}.ics`;
  link.click();
  URL.revokeObjectURL(url);
});

$("#digest-content").addEventListener("click", async event => {
  const link = event.target.closest(".digest-item");
  if (!link) return;
  event.preventDefault();
  setView("messages");
  const targetId = `message-${link.dataset.messageId}`;
  if (!document.getElementById(targetId)) {
    $("#search").value = "";
    await refresh();
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(targetId)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
});

$("#weekly-learning-content").addEventListener("click", async event => {
  const link = event.target.closest('a[href^="#message-"]');
  if (!link) return;
  event.preventDefault();
  setView("messages");
  const targetId = link.getAttribute("href").slice(1);
  document.getElementById(targetId)?.scrollIntoView({ block: "center" });
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

$("#rename-profile").addEventListener("click", async () => {
  const current = profiles.find(profile => profile.id === activeProfileId);
  const name = prompt("Çocuk profili için yeni ad veya takma ad:", current?.name ?? "");
  if (!name?.trim()) return;
  const response = await fetch(`/api/profiles/${activeProfileId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: name.trim() })
  });
  const result = await response.json();
  if (!response.ok) return alert(result.error ?? "Profil adı değiştirilemedi.");
  await loadProfiles();
  activeProfileId = result.id;
  $("#profile-select").value = String(result.id);
  await refresh($("#search").value);
});

$("#delete-profile").addEventListener("click", async () => {
  const current = profiles.find(profile => profile.id === activeProfileId);
  const warning = profiles.length === 1
    ? `${current?.name ?? "Bu profil"} ile birlikte tüm iletiler, analizler, görev durumları ve maskeleme ifadeleri kalıcı olarak silinsin mi? Uygulama ilk kurulum ekranına döner.`
    : `${current?.name ?? "Bu profil"} ve ona ait tüm iletiler, analizler, görev durumları ve maskeleme ifadeleri kalıcı olarak silinsin mi?`;
  if (!confirm(warning)) return;
  const response = await fetch(`/api/profiles/${activeProfileId}`, { method: "DELETE" });
  const result = await response.json();
  if (!response.ok) return alert(result.error ?? "Profil silinemedi.");
  localStorage.removeItem("egitim-pusulasi-profile");
  if (result.reset) {
    location.reload();
    return;
  }
  await loadProfiles();
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

$("#qa-ask").addEventListener("click", async () => {
  const question = $("#qa-question").value.trim();
  const resultBox = $("#qa-result");
  if (question.length < 3) return alert("Lütfen en az 3 karakterlik bir soru yazın.");
  resultBox.textContent = "İlgili kaynaklar cihazda aranıyor…";
  const previewResponse = await fetch("/api/qa/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: activeProfileId, question })
  });
  const preview = await previewResponse.json();
  if (!previewResponse.ok) {
    resultBox.textContent = preview.error ?? "Kaynaklar bulunamadı.";
    return;
  }
  if (!preview.sourceCount) {
    resultBox.textContent = "Bu soruyla ilgili kaynak ileti bulunamadı; AI servisine veri gönderilmedi.";
    return;
  }
  if (!preview.providerConfigured) {
    resultBox.textContent = "İlgili kaynaklar bulundu ancak AI servisi yapılandırılmamış; veri gönderilmedi.";
    return;
  }
  const masking = preview.redactionEnabled
    ? `E-posta/telefon ve ${preview.customRedactionTerms} özel ifade maskelenecek.`
    : "Maskeleme kapalı.";
  const sourceList = preview.sources.map(source => `• #${source.id} ${source.title.slice(0, 100)}`).join("\n");
  const accepted = confirm(`Soru ile seçilen iletilerin kimliği, başlığı, tarihi ve en fazla 3000 karakterlik gövdesi AI servisine gönderilecek. ${masking}\n\nKaynaklar:\n${sourceList}\n\nYaklaşık ${preview.characters} karakter gönderilecek. Devam edilsin mi?`);
  if (!accepted) {
    resultBox.textContent = "Gönderim iptal edildi; AI servisine veri gönderilmedi.";
    return;
  }
  $("#qa-ask").disabled = true;
  resultBox.textContent = "Kaynaklı yanıt hazırlanıyor…";
  const response = await fetch("/api/qa", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileId: activeProfileId, question, sourceIds: preview.sources.map(source => source.id), consent: true })
  });
  const result = await response.json();
  $("#qa-ask").disabled = !aiConfigured;
  if (!response.ok) {
    resultBox.textContent = result.error ?? "Yanıt hazırlanamadı.";
    return;
  }
  const sources = result.sources.map(source => `<a class="qa-source" href="#message-${source.id}" data-message-id="${source.id}">#${source.id} ${esc(source.title)}</a>`).join("");
  resultBox.innerHTML = `<div class="qa-answer"><strong>Yanıt</strong><p>${esc(result.answer || "Kaynaklarda yeterli yanıt bulunamadı.")}</p>${result.uncertainty ? `<p class="qa-uncertainty"><strong>Belirsizlik:</strong> ${esc(result.uncertainty)}</p>` : ""}<div class="qa-sources"><strong>Kullanılan kaynaklar</strong>${sources || "<span>AI doğrulanabilir bir kaynak kimliği döndürmedi.</span>"}</div></div>`;
});

$("#qa-result").addEventListener("click", async event => {
  const link = event.target.closest(".qa-source");
  if (!link) return;
  event.preventDefault();
  const targetId = `message-${link.dataset.messageId}`;
  if (!document.getElementById(targetId)) {
    $("#search").value = "";
    await refresh();
  }
  document.getElementById(targetId)?.scrollIntoView({ block: "center" });
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
      body: JSON.stringify({ mode: "cloud", consent: true })
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
  if (!confirm(`${profileName} için tüm yerel mesajlar, analizler ve görev durumları kalıcı olarak silinsin mi? Profil adı ve AI maskeleme listesi korunur.`)) return;
  const response = await fetch(`/api/messages?profileId=${encodeURIComponent(activeProfileId)}`, { method: "DELETE" });
  if (!response.ok) return alert("Veriler temizlenemedi.");
  await refresh();
});

$("#setup-dialog").addEventListener("cancel", event => event.preventDefault());

$("#setup-form").addEventListener("submit", async event => {
  event.preventDefault();
  const errorBox = $("#setup-error");
  errorBox.textContent = "";
  const response = await fetch("/api/setup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      profileName: $("#setup-profile").value,
      privacyAcknowledged: $("#setup-privacy").checked
    })
  });
  const result = await response.json();
  if (!response.ok) {
    errorBox.textContent = result.error ?? "İlk kurulum tamamlanamadı.";
    return;
  }
  $("#setup-dialog").close();
  await loadProfiles();
  await refresh();
});

async function initialize() {
  const today = new Date();
  $("#weekly-anchor").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const savedView = localStorage.getItem("egitim-pusulasi-view");
  setView(["today", "week", "messages", "assistant", "settings"].includes(savedView) ? savedView : "today");
  await loadProfiles();
  await refreshK12Status();
  const setup = await fetch("/api/setup").then(response => response.json());
  if (!setup.completed) {
    $("#setup-profile").value = setup.profile?.name ?? "Çocuğum";
    $("#setup-dialog").showModal();
    return;
  }
  await refresh();
}

initialize().catch(error => {
  feed.innerHTML = `<div class="empty"><strong>Bağlantı kurulamadı.</strong><span>${esc(error.message)}</span></div>`;
});
