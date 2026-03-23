// ── HELPERS ──────────────────────────────────────────────────────────────────

function todayDMY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function statusBadgeClass(status) {
  if (!status) return "";
  const s = status.toLowerCase();
  if (s.includes("resolved")) return "badge-resolved";
  if (s.includes("progress")) return "badge-inprogress";
  if (s.includes("waiting")) return "badge-waiting";
  return "badge-workgroup";
}

function workgroupBadgeClass(wg) {
  if (!wg) return "badge-workgroup";
  if (wg === "GBM_L2" || wg === "GTA_Business" || wg === "Transfer to BU")
    return "badge-escalated";
  return "badge-workgroup";
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── DATE AUTO-FORMAT (type as digits, slashes inserted automatically) ─────────

function attachDateMask(inputId) {
  const el = document.getElementById(inputId);
  el.addEventListener("input", function (e) {
    // Allow backspace/delete to work naturally
    const isDeleting = e.inputType && e.inputType.startsWith("delete");
    let digits = this.value.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) formatted = digits.slice(0, 2) + "/" + digits.slice(2);
    if (digits.length > 4) formatted = formatted.slice(0, 5) + "/" + digits.slice(4);
    if (!isDeleting || digits.length > 0) this.value = formatted;
  });
}

["creationDate", "assignDate", "handlingDate"].forEach(attachDateMask);

// ── DATE PICKER BUTTONS ───────────────────────────────────────────────────────

document.querySelectorAll(".date-pick-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const picker = btn.nextElementSibling; // the hidden <input type="date">
    // Pre-set picker to current text value so it opens on the right month
    const txt = document.getElementById(btn.dataset.target).value;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(txt)) {
      const [d, m, y] = txt.split("/");
      picker.value = `${y}-${m}-${d}`;
    }
    picker.showPicker();
  });
});

document.querySelectorAll(".hidden-picker").forEach((picker) => {
  picker.addEventListener("change", function () {
    if (!this.value) return;
    const [y, m, d] = this.value.split("-");
    document.getElementById(this.dataset.display).value = `${d}/${m}/${y}`;
    persistDraft();
  });
});

// ── STORAGE — dual write: chrome.storage.local + localStorage backup ──────────

const LS_KEY   = "gbm_l1_tickets";
const LS_PREFS = "gbm_l1_prefs";
const LS_FORM  = "gbm_l1_form_draft";

function loadTickets(cb) {
  try {
    chrome.storage.local.get("tickets", (data) => {
      if (chrome.runtime.lastError) { cb(lsLoad(LS_KEY, [])); return; }
      const a = data.tickets || [];
      const b = lsLoad(LS_KEY, []);
      cb(a.length >= b.length ? a : b);
    });
  } catch { cb(lsLoad(LS_KEY, [])); }
}

function saveTickets(tickets, cb) {
  localStorage.setItem(LS_KEY, JSON.stringify(tickets));
  try {
    chrome.storage.local.set({ tickets }, () => { if (cb) cb(); });
  } catch { if (cb) cb(); }
}

function lsLoad(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

// ── PREFS ─────────────────────────────────────────────────────────────────────

function loadPrefs(cb) {
  try {
    chrome.storage.local.get("prefs", (data) => {
      const c = (!chrome.runtime.lastError && data.prefs) || {};
      const l = lsLoad(LS_PREFS, {});
      cb({ ...l, ...c });
    });
  } catch { cb(lsLoad(LS_PREFS, {})); }
}

function savePrefs(prefs) {
  localStorage.setItem(LS_PREFS, JSON.stringify(prefs));
  try { chrome.storage.local.set({ prefs }); } catch {}
}

// ── FORM DRAFT — save/restore as user types so closing popup loses nothing ────

function readFormState() {
  return {
    caseId:           document.getElementById("caseId").value,
    tin:              document.getElementById("tin").value,
    creationDate:     document.getElementById("creationDate").value,
    assignDate:       document.getElementById("assignDate").value,
    handlingDate:     document.getElementById("handlingDate").value,
    owner:            document.getElementById("owner").value,
    priority:         document.getElementById("priority").value,
    status:           document.getElementById("status").value,
    workgroup:        document.getElementById("workgroup").value,
    issueType:        document.getElementById("issueType").value,
    description:      document.getElementById("description").value,
    reopened:         document.getElementById("reopened").checked,
    lastClosedBy:     document.getElementById("lastClosedBy").value,
    escalationReason: document.getElementById("escalationReason").value,
  };
}

function applyFormState(s) {
  document.getElementById("caseId").value           = s.caseId           || "";
  document.getElementById("tin").value              = s.tin              || "";
  document.getElementById("creationDate").value     = s.creationDate     || todayDMY();
  document.getElementById("assignDate").value       = s.assignDate       || todayDMY();
  document.getElementById("handlingDate").value     = s.handlingDate     || todayDMY();
  document.getElementById("owner").value            = s.owner            || "";
  document.getElementById("priority").value         = s.priority         || "P 3";
  document.getElementById("status").value           = s.status           || "Resolved";
  document.getElementById("workgroup").value        = s.workgroup        || "GBM_L1";
  document.getElementById("issueType").value        = s.issueType        || "";
  document.getElementById("description").value      = s.description      || "";
  document.getElementById("reopened").checked       = !!s.reopened;
  document.getElementById("reopenedLabel").textContent = s.reopened ? "Yes" : "No";
  document.getElementById("lastClosedBy").value     = s.lastClosedBy     || "";
  document.getElementById("escalationReason").value = s.escalationReason || "";
  const wg = s.workgroup || "GBM_L1";
  document.getElementById("escalationGroup").style.display =
    (wg && wg !== "GBM_L1") ? "block" : "none";
}

function persistDraft() {
  localStorage.setItem(LS_FORM, JSON.stringify(readFormState()));
}

function clearDraft() {
  localStorage.removeItem(LS_FORM);
}

// Auto-save draft on every keystroke / change
document.getElementById("ticketForm").addEventListener("input",  persistDraft);
document.getElementById("ticketForm").addEventListener("change", persistDraft);

// ── INITIALISE FORM ───────────────────────────────────────────────────────────

(function init() {
  const draft = lsLoad(LS_FORM, null);
  if (draft) {
    // Restore whatever the user had typed before closing
    applyFormState(draft);
    // Still override owner with saved pref if draft owner is blank
    if (!draft.owner) {
      loadPrefs((p) => { if (p.owner) document.getElementById("owner").value = p.owner; });
    }
  } else {
    // Fresh start — set defaults, then restore sticky owner
    applyFormState({});
    loadPrefs((p) => { if (p.owner) document.getElementById("owner").value = p.owner; });
  }
})();

// ── TAB NAVIGATION ────────────────────────────────────────────────────────────

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "history") renderHistory();
  });
});

// ── FIELD EVENTS ──────────────────────────────────────────────────────────────

document.getElementById("reopened").addEventListener("change", function () {
  document.getElementById("reopenedLabel").textContent = this.checked ? "Yes" : "No";
});

document.getElementById("workgroup").addEventListener("change", function () {
  document.getElementById("escalationGroup").style.display =
    (this.value && this.value !== "GBM_L1") ? "block" : "none";
});

document.getElementById("owner").addEventListener("change", function () {
  savePrefs({ owner: this.value });
});

// ── FORM SUBMIT ───────────────────────────────────────────────────────────────

document.getElementById("ticketForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const ticket = {
    id:               generateId(),
    savedAt:          new Date().toISOString(),
    caseId:           document.getElementById("caseId").value.trim(),
    tin:              document.getElementById("tin").value.trim(),
    creationDate:     document.getElementById("creationDate").value,
    assignDate:       document.getElementById("assignDate").value,
    handlingDate:     document.getElementById("handlingDate").value,
    owner:            document.getElementById("owner").value,
    priority:         document.getElementById("priority").value,
    status:           document.getElementById("status").value,
    workgroup:        document.getElementById("workgroup").value,
    issueType:        document.getElementById("issueType").value,
    description:      document.getElementById("description").value.trim(),
    reopened:         document.getElementById("reopened").checked ? "Yes" : "No",
    lastClosedBy:     document.getElementById("lastClosedBy").value,
    escalationReason: document.getElementById("escalationReason").value.trim(),
  };

  const ownerVal = ticket.owner;

  loadTickets((tickets) => {
    tickets.unshift(ticket);
    saveTickets(tickets, () => {
      clearDraft();
      showSuccess();
      resetForm(ownerVal);
    });
  });
});

function showSuccess() {
  const msg = document.getElementById("successMsg");
  msg.style.display = "block";
  setTimeout(() => (msg.style.display = "none"), 2500);
}

function resetForm(ownerToRestore) {
  applyFormState({ owner: ownerToRestore || "" });
  clearDraft();
  // Save the blank state so next open starts fresh
  persistDraft();
}

document.getElementById("clearBtn").addEventListener("click", () => resetForm());

// ── HISTORY ───────────────────────────────────────────────────────────────────

function renderHistory(filter = "") {
  loadTickets((tickets) => {
    const query = filter.toLowerCase();
    const filtered = query
      ? tickets.filter((t) =>
          (t.caseId || "").toLowerCase().includes(query) ||
          (t.tin || "").toLowerCase().includes(query) ||
          (t.owner || "").toLowerCase().includes(query) ||
          (t.issueType || "").toLowerCase().includes(query) ||
          (t.status || "").toLowerCase().includes(query)
        )
      : tickets;

    document.getElementById("ticketCount").textContent =
      `${filtered.length} ticket${filtered.length !== 1 ? "s" : ""}` +
      (query ? ` matching "${filter}"` : " saved");

    const listEl = document.getElementById("historyList");
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📋</div>
        <div>${query ? "No tickets match your search." : "No tickets saved yet."}</div>
      </div>`;
      return;
    }

    listEl.innerHTML = filtered.map(buildCard).join("");
    listEl.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", () => deleteTicket(btn.dataset.id));
    });
  });
}

function buildCard(t) {
  const issueLabel = t.issueType ? t.issueType.split("—")[0].trim() : "";
  const issueEn    = t.issueType && t.issueType.includes("—")
    ? t.issueType.split("—")[1].trim() : "";

  return `
    <div class="ticket-card">
      <div class="ticket-actions">
        <button class="btn-delete" data-id="${t.id}" title="Delete">✕</button>
      </div>
      <div class="ticket-card-header">
        <span class="ticket-case-id">${esc(t.caseId)}</span>
        <div class="ticket-meta">
          ${t.status   ? `<span class="badge ${statusBadgeClass(t.status)}">${esc(t.status)}</span>` : ""}
          ${t.workgroup ? `<span class="badge ${workgroupBadgeClass(t.workgroup)}">${esc(t.workgroup)}</span>` : ""}
          ${t.reopened === "Yes" ? `<span class="badge badge-escalated">Reopened</span>` : ""}
        </div>
      </div>
      <div class="ticket-details">
        <div class="detail-item"><span class="detail-label">Owner:</span><span>${esc(t.owner||"—")}</span></div>
        <div class="detail-item"><span class="detail-label">TIN:</span><span>${esc(t.tin||"—")}</span></div>
        <div class="detail-item"><span class="detail-label">Created:</span><span>${esc(t.creationDate||"—")}</span></div>
        <div class="detail-item"><span class="detail-label">Handled:</span><span>${esc(t.handlingDate||"—")}</span></div>
        <div class="detail-item"><span class="detail-label">Priority:</span><span>${esc(t.priority||"—")}</span></div>
        ${t.lastClosedBy ? `<div class="detail-item"><span class="detail-label">Closed by:</span><span>${esc(t.lastClosedBy)}</span></div>` : ""}
      </div>
      ${t.issueType ? `<div class="ticket-issue" dir="auto">${esc(issueLabel)}${issueEn ? ` <span style="color:#718096;font-weight:400;">— ${esc(issueEn)}</span>` : ""}</div>` : ""}
      ${t.description ? `<div class="ticket-desc">${esc(t.description)}</div>` : ""}
      ${t.escalationReason ? `<div class="ticket-desc" style="color:#991b1b;"><strong>Escalation:</strong> ${esc(t.escalationReason)}</div>` : ""}
    </div>`;
}

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

document.getElementById("searchBox").addEventListener("input", function () {
  renderHistory(this.value);
});

function deleteTicket(id) {
  loadTickets((tickets) => {
    saveTickets(tickets.filter((t) => t.id !== id), () =>
      renderHistory(document.getElementById("searchBox").value));
  });
}

document.getElementById("clearAllBtn").addEventListener("click", () => {
  if (confirm("Delete ALL saved tickets? This cannot be undone.")) {
    saveTickets([], () => renderHistory());
  }
});

// ── CSV EXPORT ────────────────────────────────────────────────────────────────

document.getElementById("exportBtn").addEventListener("click", () => {
  loadTickets((tickets) => {
    if (!tickets.length) { alert("No tickets to export."); return; }

    const headers = [
      "Case ID","Creation Date","Assign Date to L1","Handling Date",
      "Reopened","Last Closed By","Workgroup","Priority","Status",
      "TIN/FB/QID","Type of Issue","Description","Reasons for Reassignment",
      "Owner","Saved At",
    ];

    const rows = tickets.map((t) => [
      t.caseId, t.creationDate, t.assignDate, t.handlingDate,
      t.reopened, t.lastClosedBy, t.workgroup, t.priority, t.status,
      t.tin, t.issueType, t.description, t.escalationReason,
      t.owner, t.savedAt,
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v||"").replace(/"/g,'""')}"`).join(","))
      .join("\r\n");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `GBM_L1_Tickets_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  });
});

// ── SETTINGS ─────────────────────────────────────────────────────────────────

const LS_SETTINGS = "gbm_l1_ai_settings";

function loadAiSettings() {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) ?? {}; }
  catch { return {}; }
}

function saveAiSettings(s) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
  try { chrome.storage.local.set({ aiSettings: s }); } catch {}
}

(function initSettings() {
  // Try chrome.storage first, fall back to localStorage
  try {
    chrome.storage.local.get("aiSettings", (data) => {
      const s = (!chrome.runtime.lastError && data.aiSettings) || loadAiSettings();
      if (s.openaiKey)   document.getElementById("openaiKey").value   = s.openaiKey;
      if (s.openaiModel) document.getElementById("openaiModel").value = s.openaiModel;
    });
  } catch {
    const s = loadAiSettings();
    if (s.openaiKey)   document.getElementById("openaiKey").value   = s.openaiKey;
    if (s.openaiModel) document.getElementById("openaiModel").value = s.openaiModel;
  }
})();

document.getElementById("saveSettingsBtn").addEventListener("click", () => {
  const s = {
    openaiKey:   document.getElementById("openaiKey").value.trim(),
    openaiModel: document.getElementById("openaiModel").value,
  };
  saveAiSettings(s);
  const msg = document.getElementById("settingsSaved");
  msg.style.display = "block";
  setTimeout(() => (msg.style.display = "none"), 2000);
});

// ── AI AUTO-FILL ──────────────────────────────────────────────────────────────

const ISSUE_TYPE_VALUES = [
  "تحديث بيانات الشركة", "تسجيل", "تفعيل رقم ضريبي", "المخول بالتوقيع", "توكيل",
  "فتح / الغاء / تعديل فترات", "تسجل / ترحيل اقرارات",
  "سداد", "جزاءات", "اعفاء", "شهادات", "مبايعه", "طلبات", "خطأ تقني",
];

document.getElementById("autoFillBtn").addEventListener("click", async () => {
  const btn    = document.getElementById("autoFillBtn");
  const status = document.getElementById("aiStatus");

  const settings = loadAiSettings();
  try {
    chrome.storage.local.get("aiSettings", (data) => {
      if (!chrome.runtime.lastError && data.aiSettings?.openaiKey) {
        Object.assign(settings, data.aiSettings);
      }
    });
  } catch {}

  const apiKey = settings.openaiKey || "";
  const model  = settings.openaiModel || "gpt-4o-mini";

  function resetBtn() {
    btn.disabled    = false;
    btn.textContent = "✨ Auto-fill from current page";
  }

  function showAiStatus(msg, type) {
    status.textContent   = msg;
    status.className     = `ai-status ${type}`;
    status.style.display = "block";
  }

  if (!apiKey) {
    showAiStatus("No API key set — go to the Settings tab and add your OpenAI key.", "error");
    return;
  }

  btn.disabled    = true;
  btn.textContent = "Reading page...";
  status.style.display = "none";

  // Step 1: grab page text via content script injection
  let pageText;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText.slice(0, 8000),
    });
    pageText = results[0].result;
  } catch (err) {
    showAiStatus("Could not read the page. Make sure you're on a ticket page.", "error");
    resetBtn();
    return;
  }

  btn.textContent = "Asking AI...";

  const systemPrompt = `You are a ticket data extractor for a tax authority support system.
Given webpage text, extract ticket fields and return ONLY a valid JSON object (no markdown, no explanation).
Omit any field you cannot confidently find. Use these exact keys and allowed values:

- caseId: the ticket/case ID string (e.g. CAS-23393-L3T8)
- tin: taxpayer ID, Facebook ID, or QID number
- creationDate: date the case was created — format DD/MM/YYYY
- assignDate: date assigned to L1 — format DD/MM/YYYY
- handlingDate: date handled/resolved — format DD/MM/YYYY
- priority: exactly one of "P 1", "P 2", "P 3"
- status: exactly one of "Resolved", "In progress", "Waiting for details"
- workgroup: exactly one of "GBM_L1", "GBM_L2", "GTA_Business", "Transfer to BU"
- issueType: exactly one of: ${ISSUE_TYPE_VALUES.join(" | ")}
- description: brief description of the issue in the agent's language
- reopened: boolean true or false
- lastClosedBy: full name of person who last closed the case
- escalationReason: reason for escalation or reassignment if present`;

  let extracted;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: pageText },
        ],
        temperature: 0,
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `HTTP ${res.status}`);
    }

    const data    = await res.json();
    const raw     = data.choices[0].message.content.trim();
    const jsonStr = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/, "");
    extracted     = JSON.parse(jsonStr);
  } catch (err) {
    showAiStatus(`AI error: ${err.message}`, "error");
    resetBtn();
    return;
  }

  // Merge extracted values over current form state (don't erase existing values)
  const merged = { ...readFormState() };
  const map = [
    "caseId","tin","creationDate","assignDate","handlingDate",
    "priority","status","workgroup","issueType","description",
    "lastClosedBy","escalationReason",
  ];
  map.forEach((k) => { if (extracted[k] != null && extracted[k] !== "") merged[k] = extracted[k]; });
  if (extracted.reopened != null) merged.reopened = !!extracted.reopened;

  applyFormState(merged);
  persistDraft();

  const count = Object.keys(extracted).length;
  showAiStatus(`Filled ${count} field${count !== 1 ? "s" : ""}. Review and adjust as needed.`, "success");
  resetBtn();
});
