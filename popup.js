// popup.js

const DEFAULT_OFFERS = [
  { offeringType: "wood",  offeringAmount: 1000, wantingType: "food", wantingAmount: 1700, count: 3 },
  { offeringType: "brick", offeringAmount: 1000, wantingType: "food", wantingAmount: 1700, count: 3 },
  { offeringType: "ore",   offeringAmount: 1000, wantingType: "food", wantingAmount: 1700, count: 3 },
];
const DEFAULT_RUNTIME = 12;

// ── Tab switching ──────────────────────────────────────────────────────────────────────────────────────

const tabs = {
  units:    { btn: document.getElementById("tab-units"),    panel: document.getElementById("panel-units"),    activeClass: "active-units" },
  reports:  { btn: document.getElementById("tab-reports"),  panel: document.getElementById("panel-reports"),  activeClass: "active-reports" },
  market:   { btn: document.getElementById("tab-market"),   panel: document.getElementById("panel-market"),   activeClass: "active-market" },
  settings: { btn: document.getElementById("tab-settings"), panel: document.getElementById("panel-settings"), activeClass: "active-settings" },
};

function switchTab(name) {
  Object.entries(tabs).forEach(([key, t]) => {
    t.btn.classList.toggle(t.activeClass, key === name);
    t.panel.classList.toggle("active", key === name);
  });
  chrome.storage.local.set({ lastTab: name });
}

Object.keys(tabs).forEach(name => {
  tabs[name].btn.addEventListener("click", () => switchTab(name));
});

// ── Shared helpers ────────────────────────────────────────────────────────────────────────────────────

const dot = document.getElementById("status-dot");
function setDot(state) { dot.className = `dot ${state}`; }

function setStatus(elId, msg, type = "") {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.className   = `status ${type}`;
}

function downloadJSON(payload, prefix) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const ts   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href     = url;
  a.download = `${prefix}-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function sendToSupabase(table, payload, statusId, btnSend, btnRead) {
  const { supabaseUrl, supabaseAnonKey } = await chrome.storage.local.get(["supabaseUrl", "supabaseAnonKey"]);
  if (!supabaseUrl || !supabaseAnonKey) {
    setStatus(statusId, "Configure Supabase in Settings first.", "error");
    setDot("error");
    switchTab("settings");
    return;
  }
  setDot("loading");
  setStatus(statusId, "Sending…");
  btnSend.disabled = true;
  btnRead.disabled = true;

  chrome.runtime.sendMessage({ type: "SEND_TO_SUPABASE", table, payload }, (response) => {
    btnRead.disabled = false;
    if (!response?.success) {
      setStatus(statusId, `Failed: ${response?.error ?? "Unknown error."}`, "error");
      setDot("error");
      btnSend.disabled = false;
      return;
    }
    setStatus(statusId, "Saved to Supabase!", "success");
    setDot("ready");
  });
}

// ── Feature toggles ─────────────────────────────────────────────────────────────────────────────────────

const TOGGLE_DEFAULTS = { units: false, reports: true, market: true };
const TOGGLEABLE_TABS = Object.keys(TOGGLE_DEFAULTS);

function applyToggles(toggles) {
  for (const name of TOGGLEABLE_TABS) {
    const visible = toggles[name] ?? TOGGLE_DEFAULTS[name];
    tabs[name].btn.classList.toggle("hidden", !visible);
    document.getElementById(`toggle-${name}`).checked = visible;
  }
  const activeTab = Object.keys(tabs).find(k => tabs[k].panel.classList.contains("active"));
  if (activeTab && tabs[activeTab].btn.classList.contains("hidden")) {
    switchTab("settings");
  }
}

function readTogglesFromUI() {
  const toggles = {};
  for (const name of TOGGLEABLE_TABS) {
    toggles[name] = document.getElementById(`toggle-${name}`).checked;
  }
  return toggles;
}

// ── Load saved settings ──────────────────────────────────────────────────────────────────────────────────

chrome.storage.local.get(
  ["supabaseUrl", "supabaseAnonKey", "marketOffers", "marketRuntime", "lastTab", "featureToggles"],
  ({ supabaseUrl, supabaseAnonKey, marketOffers, marketRuntime, lastTab, featureToggles }) => {
    if (supabaseUrl)     document.getElementById("cfg-url").value = supabaseUrl;
    if (supabaseAnonKey) document.getElementById("cfg-key").value = supabaseAnonKey;
    renderOffersUI(marketOffers ?? DEFAULT_OFFERS);
    document.getElementById("cfg-runtime").value = marketRuntime ?? DEFAULT_RUNTIME;
    applyToggles(featureToggles ?? TOGGLE_DEFAULTS);
    if (lastTab && tabs[lastTab] && !tabs[lastTab].btn.classList.contains("hidden")) {
      switchTab(lastTab);
    }
    checkActiveTab();
  }
);

// ── Save settings ──────────────────────────────────────────────────────────────────────────────────────

document.getElementById("btn-save").addEventListener("click", async () => {
  const url = document.getElementById("cfg-url").value.trim().replace(/\/$/, "");
  const key = document.getElementById("cfg-key").value.trim();
  const featureToggles = readTogglesFromUI();
  if (!url || !key) { setStatus("settings-status", "Fill in URL and anon key.", "error"); return; }
  await chrome.storage.local.set({ supabaseUrl: url, supabaseAnonKey: key, featureToggles });
  applyToggles(featureToggles);
  setStatus("settings-status", "Settings saved.", "success");
  setTimeout(() => setStatus("settings-status", ""), 2000);
});

// ── Units tab ────────────────────────────────────────────────────────────────────────────────────

const wuPreview = document.getElementById("wu-preview");
const wuBtnRead = document.getElementById("wu-btn-read");
const wuBtnDl   = document.getElementById("wu-btn-dl");
const wuBtnSend = document.getElementById("wu-btn-send");
let wuPayload   = null;

function renderUnitsPreview(data) {
  wuPreview.innerHTML = data.players.map(p => `
    <div class="player-block">
      <div class="player-name">
        <span>${p.player}</span>
        <span class="player-city">${p.city} <span class="village-id">#${p.village_id}</span></span>
      </div>
      <div class="unit-list">${p.units.map(u => `
        <div class="unit-row">
          <span>${u.unit} <span class="unit-id">${u.unit_id ?? ""}</span></span>
          <span class="count">${u.count.toLocaleString()} / ${u.max_count.toLocaleString()}</span>
        </div>`).join("")}
      </div>
    </div>`).join("");
  wuPreview.classList.add("visible");
}

wuBtnRead.addEventListener("click", async () => {
  setDot("loading");
  setStatus("wu-status", "Reading page…");
  wuBtnRead.disabled = true;
  wuBtnDl.disabled   = true;
  wuBtnSend.disabled = true;
  wuPreview.classList.remove("visible");
  wuPayload = null;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["features/unit-reader/content.js"] }); } catch {}

  chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_UNITS" }, (response) => {
    wuBtnRead.disabled = false;
    if (chrome.runtime.lastError || !response) {
      setStatus("wu-status", "No response. Is the unit support panel open?", "error");
      setDot("error"); return;
    }
    if (!response.success) {
      setStatus("wu-status", response.error ?? "Scraping failed.", "error");
      setDot("error"); return;
    }
    wuPayload = response.data;
    renderUnitsPreview(response.data);
    setStatus("wu-status", `${response.data.total_players} player(s), ${response.data.total_units} unit type(s).`, "success");
    setDot("ready");
    wuBtnDl.disabled   = false;
    wuBtnSend.disabled = false;
  });
});

wuBtnDl.addEventListener("click", () => {
  if (!wuPayload) return;
  downloadJSON(wuPayload, "wildungs-units");
  setStatus("wu-status", "JSON downloaded.", "success");
  setTimeout(() => setStatus("wu-status", `${wuPayload.total_players} player(s) ready.`, "success"), 1500);
});

wuBtnSend.addEventListener("click", () => {
  if (!wuPayload) return;
  sendToSupabase("unit_snapshots", wuPayload, "wu-status", wuBtnSend, wuBtnRead);
});

// ── Reports tab ──────────────────────────────────────────────────────────────────────────────────
//
// Single-button "Save report" flow:
//   1. Inject content script into the active tab.
//   2. Send CAPTURE_REPORT → receive { report_id, dom_html, extracted, meta }.
//   3. Send SEND_REPORT to the service worker → background does dedup + dual-write.
//   4. Surface a per-store status: ok / skipped / error.

const wgBtnSave = document.getElementById("wg-btn-save");

function formatReportStatus(response) {
  if (response.duplicate) return "Already saved — skipped.";
  const parts = [];
  if (response.astra)    parts.push(`Astra: ${response.astra}`);
  if (response.supabase) parts.push(`Supabase: ${response.supabase}`);
  return parts.join(" · ") || "Saved.";
}

wgBtnSave.addEventListener("click", async () => {
  setDot("loading");
  setStatus("wg-status", "Reading report…");
  wgBtnSave.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["features/battle-reports/content.js"] }); } catch {}

    const captured = await new Promise(resolve => {
      chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_REPORT" }, response => {
        if (chrome.runtime.lastError || !response) {
          resolve({ success: false, error: "No response. Open a WildGuns battle report first." });
          return;
        }
        resolve(response);
      });
    });
    if (!captured.success) {
      setStatus("wg-status", captured.error ?? "Failed to read report.", "error");
      setDot("error");
      return;
    }
    if (!captured.data.report_id) {
      setStatus("wg-status", "Report has no report_id in URL — open it from the mail list.", "error");
      setDot("error");
      return;
    }

    setStatus("wg-status", "Saving…");
    const result = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: "SEND_REPORT", captured: captured.data }, response => {
        resolve(response ?? { success: false, error: "No response from background." });
      });
    });

    if (!result.success) {
      const parts = [];
      if (result.astra)    parts.push(`Astra: ${result.astra}`);
      if (result.supabase) parts.push(`Supabase: ${result.supabase}`);
      const detail = parts.length ? ` (${parts.join(" · ")})` : "";
      setStatus("wg-status", `${result.error ?? "Save failed."}${detail}`, "error");
      setDot("error");
      return;
    }

    setStatus("wg-status", formatReportStatus(result), "success");
    setDot("ready");
  } finally {
    wgBtnSave.disabled = false;
  }
});

// ── Market tab ───────────────────────────────────────────────────────────────────────────────────

const btnMarket  = document.getElementById("btn-market");
const offersList = document.getElementById("offers-list");
const RESOURCES  = ["wood", "brick", "ore", "food", "gold", "horses"];

function resourceSelect(value) {
  return `<select>${RESOURCES.map(r =>
    `<option value="${r}"${r === value ? " selected" : ""}>${r}</option>`
  ).join("")}</select>`;
}

function addOfferRow(offer) {
  const row = document.createElement("div");
  row.className = "offer-row";
  row.innerHTML = `
    ${resourceSelect(offer.offeringType)}
    <input type="number" min="1" value="${offer.offeringAmount}" title="Offering amount">
    <span class="offer-arrow">→</span>
    ${resourceSelect(offer.wantingType)}
    <input type="number" min="1" value="${offer.wantingAmount}" title="Wanting amount">
    <input type="number" min="1" max="99" value="${offer.count}" title="Count">
    <button class="btn-remove-offer" title="Remove">×</button>`;
  row.querySelector(".btn-remove-offer").addEventListener("click", () => row.remove());
  offersList.appendChild(row);
}

function renderOffersUI(offers) {
  offersList.innerHTML = "";
  offers.forEach(o => addOfferRow(o));
}

function readOffersFromUI() {
  const rows = offersList.querySelectorAll(".offer-row");
  if (rows.length === 0) return DEFAULT_OFFERS;
  return Array.from(rows).map(row => {
    const selects = row.querySelectorAll("select");
    const inputs  = row.querySelectorAll("input[type='number']");
    return {
      offeringType:   selects[0].value,
      offeringAmount: parseInt(inputs[0].value, 10) || 1000,
      wantingType:    selects[1].value,
      wantingAmount:  parseInt(inputs[1].value, 10) || 1700,
      count:          parseInt(inputs[2].value, 10) || 1,
    };
  });
}

document.getElementById("btn-add-offer").addEventListener("click", () => {
  addOfferRow({ offeringType: "wood", offeringAmount: 1000, wantingType: "food", wantingAmount: 1700, count: 1 });
});

async function checkActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isGame = tab?.url &&
    (tab.url.includes("wildungs.com") || tab.url.includes("wildguns.gameforge.com"));
  btnMarket.disabled = !isGame;
}

btnMarket.addEventListener("click", async () => {
  const offers  = readOffersFromUI();
  const runtime = parseInt(document.getElementById("cfg-runtime").value, 10) || DEFAULT_RUNTIME;
  await chrome.storage.local.set({ marketOffers: offers, marketRuntime: runtime });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world:  "MAIN",
      func:   runMarketOffers,
      args:   [offers, runtime],
    });
    setStatus("market-status", `Sent ${offers.reduce((s, o) => s + o.count, 0)} offer(s).`, "success");
    setTimeout(() => setStatus("market-status", ""), 2000);
  } catch (e) {
    setStatus("market-status", "Failed: " + e.message, "error");
  }
});

function runMarketOffers(offers, runtime) {
  if (typeof userToken === "undefined" || !userToken) {
    console.error("userToken not found on page.");
    return;
  }

  var tasks = [];
  for (var o = 0; o < offers.length; o++) {
    var offer = offers[o];
    for (var i = 0; i < offer.count; i++) {
      tasks.push({ offer: offer, index: i + 1 });
    }
  }

  console.log("Sending " + tasks.length + " total requests...");

  var promises = [];
  for (var j = 0; j < tasks.length; j++) {
    (function(task) {
      var url = "ajax_interface.php?" + new URLSearchParams({
        ajax_action:    "newMarketOffer",
        userToken:      userToken,
        offeringType:   task.offer.offeringType,
        offeringAmount: task.offer.offeringAmount,
        wantingType:    task.offer.wantingType,
        wantingAmount:  task.offer.wantingAmount,
        runtime:        runtime,
      });
      promises.push(
        fetch(url, { credentials: "include" }).then(function(res) {
          return res.text().then(function(text) {
            console.log(
              "[" + task.offer.offeringType + " " + task.index + "/" + task.offer.count + "]"
              + " " + task.offer.offeringAmount + "->" + task.offer.wantingAmount + " " + task.offer.wantingType
              + " | Status: " + res.status + " | " + text
            );
            return { offer: task.offer, index: task.index, status: res.status, body: text };
          });
        })
      );
    })(tasks[j]);
  }

  Promise.allSettled(promises).then(function(results) {
    var succeeded = 0, failed = 0;
    for (var k = 0; k < results.length; k++) {
      if (results[k].status === "fulfilled") succeeded++;
      else failed++;
    }
    console.log("Done. " + succeeded + " succeeded, " + failed + " failed.");
  });
}

