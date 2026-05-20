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

const wgPreview = document.getElementById("wg-preview");
const wgBtnRead = document.getElementById("wg-btn-read");
const wgBtnDl   = document.getElementById("wg-btn-dl");
const wgBtnSend = document.getElementById("wg-btn-send");
let wgPayload   = null;

function renderSide(label, cssClass, data) {
  if (!data) return "";
  const unitRows = (data.units || []).map(u =>
    `<div class="unit-row">
      <span>${u.unit}${u.is_group ? ` <span class="group-badge">&#9733;${u.group_level ?? ""}</span>` : ""}</span>
      <span class="count">${u.count} <span class="losses">-${u.losses}</span></span>
    </div>`
  ).join("") || `<div class="unit-row" style="color:#bbb;font-style:italic;">no units</div>`;
  return `
    <div class="side-block">
      <div class="side-label ${cssClass}">${label}</div>
      <div class="side-player"><span>${data.player ?? "?"}</span><span style="font-weight:400;color:#888;">${data.city ?? "?"}</span></div>
      ${unitRows}
    </div>`;
}

function renderSpyPreview(spy) {
  if (!spy) return "";
  const res = spy.raw_materials;
  const resLine = Object.entries(res).map(([k, v]) => `${k}: ${v}`).join(", ");
  const bldgCount = spy.buildings.length;
  const unitCount = spy.units.length + spy.groups.length;
  return `
    <div class="side-block">
      <div class="side-label" style="color:#854F0B;">Spy report</div>
      ${resLine ? `<div class="unit-row"><span>Resources</span><span class="count">${resLine}</span></div>` : ""}
      ${unitCount > 0 ? `<div class="unit-row"><span>Units/Groups</span><span class="count">${unitCount} type(s)</span></div>` : ""}
      ${bldgCount > 0 ? `<div class="unit-row"><span>Buildings</span><span class="count">${bldgCount} scanned</span></div>` : ""}
    </div>`;
}

function renderReportsPreview(d) {
  wgPreview.innerHTML = `
    <div class="report-title">${d.title ?? "Battle report"}</div>
    <div class="report-meta">
      <span>${d.date ?? ""}</span>
      ${d.luck    ? `<span>Luck: ${d.luck}</span>`       : ""}
      ${d.loyalty ? `<span>Loyalty: ${d.loyalty}</span>` : ""}
    </div>
    ${renderSide("Attacker", "atk", d.attacker)}
    ${renderSide("Defender", "def", d.defender)}
    ${renderSpyPreview(d.spy_report)}`;
  wgPreview.classList.add("visible");
}

wgBtnRead.addEventListener("click", async () => {
  setDot("loading");
  setStatus("wg-status", "Reading report…");
  wgBtnRead.disabled = true;
  wgBtnDl.disabled   = true;
  wgBtnSend.disabled = true;
  wgPreview.classList.remove("visible");
  wgPayload = null;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["features/battle-reports/content.js"] }); } catch {}

  chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_WILDGUNS" }, (response) => {
    wgBtnRead.disabled = false;
    if (chrome.runtime.lastError || !response) {
      setStatus("wg-status", "No response. Open a WildGuns battle report first.", "error");
      setDot("error"); return;
    }
    if (!response.success) {
      setStatus("wg-status", response.error ?? "Failed to parse report.", "error");
      setDot("error"); return;
    }
    wgPayload = response.data;
    renderReportsPreview(response.data);
    const atk = response.data.attacker?.units?.length ?? 0;
    const def = response.data.defender?.units?.length ?? 0;
    setStatus("wg-status", `${atk} attacker unit type(s), ${def} defender unit type(s).`, "success");
    setDot("ready");
    wgBtnDl.disabled   = false;
    wgBtnSend.disabled = false;
  });
});

wgBtnDl.addEventListener("click", () => {
  if (!wgPayload) return;
  downloadJSON(wgPayload, "wildguns-report");
  setStatus("wg-status", "JSON downloaded.", "success");
  setTimeout(() => setStatus("wg-status", "Report ready.", "success"), 1500);
});

wgBtnSend.addEventListener("click", () => {
  if (!wgPayload) return;
  sendToSupabase("battle_reports", wgPayload, "wg-status", wgBtnSend, wgBtnRead);
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


// ── Send resources by coordinates (Market tab sub-section) ──────────────────────────────
//
// Two input modes share a single "Send transports" button:
//   1. Saved presets — quick one-click recurring transports (max 10, LRU eviction).
//   2. Ad-hoc table  — one row per (X|Y, wood, brick, ore, food) tuple.
//
// Both flows submit through the same content-script function
// (sendTransportsOnPage) which the page-injected resource-transfer module
// dispatches to the requestMarketTransport endpoint.

const { addPresetWithCap, removePreset, validatePreset } = self.presetsStore;

const transportsListEl  = document.getElementById("transports-list");
const presetsListEl     = document.getElementById("presets-list");
const btnAddTransport   = document.getElementById("btn-add-transport");
const btnPasteTransp    = document.getElementById("btn-paste-transports");
const btnClearTransp    = document.getElementById("btn-clear-transports");
const btnSendTransp     = document.getElementById("btn-send-transports");

let presetsCache = [];

// ── Ad-hoc table ────────────────────────────────────────────────────────────────────────

function addTransportRow(preset) {
  const row = document.createElement("div");
  row.className = "transport-row";
  const coords = preset ? `${preset.targetX}|${preset.targetY}` : "";
  row.innerHTML = `
    <input type="text"   class="t-coords" placeholder="500|500" value="${coords}">
    <input type="number" class="t-wood"   min="0" value="${preset?.amountWood  ?? 0}">
    <input type="number" class="t-brick"  min="0" value="${preset?.amountBrick ?? 0}">
    <input type="number" class="t-ore"    min="0" value="${preset?.amountOre   ?? 0}">
    <input type="number" class="t-food"   min="0" value="${preset?.amountFood  ?? 0}">
    <span class="transport-status-cell">·</span>
    <button class="btn-remove-transport" title="Remove row">×</button>`;
  row.querySelector(".btn-remove-transport").addEventListener("click", () => {
    row.remove();
    updateSendTransportsState();
  });
  row.querySelectorAll("input").forEach(input => input.addEventListener("input", updateSendTransportsState));
  transportsListEl.appendChild(row);
  updateSendTransportsState();
  return row;
}

function readTransportRows() {
  const rows = transportsListEl.querySelectorAll(".transport-row");
  return Array.from(rows).map(row => {
    const coordsInput = row.querySelector(".t-coords");
    const parsed = (coordsInput.value.trim().match(/^(\d+)\s*\|\s*(\d+)$/));
    return {
      row,
      coordsInput,
      targetX:     parsed ? parseInt(parsed[1], 10) : NaN,
      targetY:     parsed ? parseInt(parsed[2], 10) : NaN,
      amountWood:  parseInt(row.querySelector(".t-wood").value,  10) || 0,
      amountBrick: parseInt(row.querySelector(".t-brick").value, 10) || 0,
      amountOre:   parseInt(row.querySelector(".t-ore").value,   10) || 0,
      amountFood:  parseInt(row.querySelector(".t-food").value,  10) || 0,
    };
  });
}

function transportIsValid(t) {
  if (!Number.isInteger(t.targetX) || !Number.isInteger(t.targetY)) return false;
  const total = t.amountWood + t.amountBrick + t.amountOre + t.amountFood;
  return total > 0;
}

function updateSendTransportsState() {
  const rows = readTransportRows();
  const anyValid = rows.some(transportIsValid);
  // Mark invalid coord cells (only if the user typed something — empty rows stay neutral)
  for (const r of rows) {
    const empty = r.coordsInput.value.trim() === "";
    const invalid = !empty && (!Number.isInteger(r.targetX) || !Number.isInteger(r.targetY));
    r.coordsInput.classList.toggle("invalid", invalid);
  }
  btnSendTransp.disabled = !anyValid || btnSendTransp.dataset.busy === "1";
}

btnAddTransport.addEventListener("click", () => addTransportRow());

btnClearTransp.addEventListener("click", () => {
  transportsListEl.innerHTML = "";
  updateSendTransportsState();
});

btnPasteTransp.addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) {
      setStatus("transport-status", "Clipboard is empty.", "error");
      return;
    }
    let added = 0;
    for (const line of lines) {
      const parts = line.split(/[\s,;\t]+/).filter(Boolean);
      if (parts.length < 2) continue;
      const coordMatch = parts[0].match(/^(\d+)\s*\|\s*(\d+)$/);
      if (!coordMatch) continue;
      addTransportRow({
        targetX:     parseInt(coordMatch[1], 10),
        targetY:     parseInt(coordMatch[2], 10),
        amountWood:  parseInt(parts[1], 10) || 0,
        amountBrick: parseInt(parts[2], 10) || 0,
        amountOre:   parseInt(parts[3], 10) || 0,
        amountFood:  parseInt(parts[4], 10) || 0,
      });
      added++;
    }
    setStatus("transport-status", `Pasted ${added} row(s).`, added > 0 ? "success" : "error");
    if (added > 0) setTimeout(() => setStatus("transport-status", ""), 2000);
  } catch (e) {
    setStatus("transport-status", "Could not read clipboard: " + e.message, "error");
  }
});

// ── Send (ad-hoc table) ─────────────────────────────────────────────────────────────────

async function sendTransportPayload(transports) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isGame = tab?.url && (tab.url.includes("wildungs.com") || tab.url.includes("wildguns.gameforge.com"));
  if (!isGame) {
    throw new Error("Active tab must be the game.");
  }
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world:  "MAIN",
    func:   sendTransportsOnPageInjected,
    args:   [transports],
  });
  return result;
}

btnSendTransp.addEventListener("click", async () => {
  const rows = readTransportRows();
  const valid = rows.filter(transportIsValid);
  if (!valid.length) {
    setStatus("transport-status", "Fill at least one row with coords + amount.", "error");
    return;
  }
  btnSendTransp.dataset.busy = "1";
  btnSendTransp.disabled = true;
  setDot("loading");
  setStatus("transport-status", `Sending ${valid.length} transport(s)…`);
  // Mark every selected row busy
  for (const r of valid) r.row.querySelector(".transport-status-cell").className = "transport-status-cell busy";

  try {
    const payload = valid.map(r => ({
      targetX: r.targetX, targetY: r.targetY,
      amountWood: r.amountWood, amountBrick: r.amountBrick,
      amountOre:  r.amountOre,  amountFood:  r.amountFood,
    }));
    const result = await sendTransportPayload(payload);
    if (!result?.ok) {
      throw new Error(result?.error ?? "Page driver returned no result.");
    }
    let succeeded = 0, failed = 0;
    result.results.forEach((r, i) => {
      const cell = valid[i].row.querySelector(".transport-status-cell");
      if (r?.status === "fulfilled" && r.value?.ok) {
        cell.className = "transport-status-cell ok"; cell.textContent = "✓"; cell.title = "Sent";
        succeeded++;
      } else {
        cell.className = "transport-status-cell err"; cell.textContent = "✗";
        cell.title = (r?.value?.error ?? r?.reason?.message ?? "Failed").toString();
        failed++;
      }
    });
    setStatus("transport-status", `${succeeded} sent, ${failed} failed.`, failed ? "error" : "success");
    setDot(failed ? "error" : "ready");
  } catch (e) {
    setStatus("transport-status", "Failed: " + e.message, "error");
    setDot("error");
    for (const r of valid) {
      const cell = r.row.querySelector(".transport-status-cell");
      cell.className = "transport-status-cell err"; cell.textContent = "✗"; cell.title = e.message;
    }
  } finally {
    btnSendTransp.dataset.busy = "";
    updateSendTransportsState();
  }
});

// Mirror of features/resource-transfer/content.js' sendTransportsOnPage, kept
// inline because chrome.scripting.executeScript with `func:` can only
// serialise a single function body — it cannot pull in other content scripts.
function sendTransportsOnPageInjected(transports) {
  if (typeof userToken === "undefined" || !userToken) {
    return { ok: false, error: "userToken not found on page. Are you logged into the game?" };
  }
  var origin = window.location.origin;

  function buildUrl(t) {
    var p = new URLSearchParams({
      ajax_action: "requestMarketTransport",
      amountWood:  String(t.amountWood),
      amountBrick: String(t.amountBrick),
      amountOre:   String(t.amountOre),
      amountFood:  String(t.amountFood),
      targetX:     String(t.targetX),
      targetY:     String(t.targetY),
      userToken:   String(userToken),
    });
    return origin + "/ajax_interface.php?" + p.toString();
  }

  function sendOne(t) {
    return fetch(buildUrl(t), {
      method: "GET",
      credentials: "include",
      headers: { "x-requested-with": "XMLHttpRequest", "x-prototype-version": "1.7.3" },
    }).then(function(res) {
      if (!res.ok) return { ok: false, status: res.status, error: "HTTP " + res.status };
      return res.text().then(function(body) {
        var lower = body.toLowerCase();
        if (lower.includes("error") && !lower.includes("\"error\":null")) {
          return { ok: false, status: res.status, error: body.slice(0, 200) };
        }
        return { ok: true, status: res.status };
      });
    });
  }

  var cap = 4;
  var next = 0;
  var results = new Array(transports.length);
  function runOne() {
    var i = next++;
    if (i >= transports.length) return Promise.resolve();
    return sendOne(transports[i])
      .then(function(r)  { results[i] = { status: "fulfilled", value: r }; })
      .catch(function(e) { results[i] = { status: "rejected",  reason: { message: String(e && e.message || e) } }; })
      .then(runOne);
  }
  var workers = [];
  for (var w = 0; w < Math.min(cap, transports.length); w++) workers.push(runOne());
  return Promise.all(workers).then(function() { return { ok: true, results: results }; });
}

// ── Saved presets ───────────────────────────────────────────────────────────────────────

function renderPresets() {
  presetsListEl.innerHTML = "";
  if (!presetsCache.length) return;
  for (const p of presetsCache) {
    const row = document.createElement("div");
    row.className = "preset-row";
    row.innerHTML = `
      <div>
        <div class="preset-name"></div>
        <div class="preset-meta">${p.targetX}|${p.targetY} · ${p.amountWood}/${p.amountBrick}/${p.amountOre}/${p.amountFood}</div>
      </div>
      <button class="btn-preset-send"   title="Send this preset">↗</button>
      <button class="btn-preset-load"   title="Load into ad-hoc row">+</button>
      <button class="btn-preset-delete" title="Delete preset">×</button>`;
    row.querySelector(".preset-name").textContent = p.name; // safe: avoids HTML injection
    row.querySelector(".btn-preset-send").addEventListener("click", () => sendPreset(p));
    row.querySelector(".btn-preset-load").addEventListener("click", () => addTransportRow(p));
    row.querySelector(".btn-preset-delete").addEventListener("click", () => deletePreset(p.id));
    presetsListEl.appendChild(row);
  }
}

async function loadPresetsFromStorage() {
  const { marketPresets } = await chrome.storage.local.get(["marketPresets"]);
  presetsCache = Array.isArray(marketPresets) ? marketPresets : [];
  renderPresets();
}

async function sendPreset(p) {
  setDot("loading");
  setStatus("transport-status", `Sending preset "${p.name}"…`);
  try {
    const result = await sendTransportPayload([{
      targetX: p.targetX, targetY: p.targetY,
      amountWood: p.amountWood, amountBrick: p.amountBrick,
      amountOre:  p.amountOre,  amountFood:  p.amountFood,
    }]);
    const ok = result?.ok && result.results[0]?.status === "fulfilled" && result.results[0].value?.ok;
    setStatus("transport-status", ok ? `Preset "${p.name}" sent.` : `Preset "${p.name}" failed.`, ok ? "success" : "error");
    setDot(ok ? "ready" : "error");
  } catch (e) {
    setStatus("transport-status", "Failed: " + e.message, "error");
    setDot("error");
  }
}

async function deletePreset(id) {
  presetsCache = removePreset(presetsCache, id);
  await chrome.storage.local.set({ marketPresets: presetsCache });
  renderPresets();
}

// "Save as preset" — promotes the FIRST valid ad-hoc row into a new preset.
// (We don't add a per-row save button to keep the table compact; instead the
// user fills a row and uses the Save flow via a name prompt.)
async function savePresetFromFirstRow() {
  const rows = readTransportRows();
  const first = rows.find(transportIsValid);
  if (!first) {
    setStatus("transport-status", "Fill a row with coords + amounts first.", "error");
    return;
  }
  const name = window.prompt("Name this preset:", `${first.targetX}|${first.targetY}`);
  if (!name) return;
  try {
    const { presets, dropped } = addPresetWithCap(presetsCache, {
      name,
      targetX: first.targetX, targetY: first.targetY,
      amountWood:  first.amountWood,  amountBrick: first.amountBrick,
      amountOre:   first.amountOre,   amountFood:  first.amountFood,
    });
    presetsCache = presets;
    await chrome.storage.local.set({ marketPresets: presetsCache });
    renderPresets();
    if (dropped) {
      setStatus("transport-status", `Saved. Oldest preset "${dropped.name}" was evicted.`, "success");
    } else {
      setStatus("transport-status", `Saved preset "${name}".`, "success");
    }
    setTimeout(() => setStatus("transport-status", ""), 2500);
  } catch (e) {
    setStatus("transport-status", "Save failed: " + e.message, "error");
  }
}

// Expose Save-preset on the existing "Paste" row (long-press / shift-click)
// would be over-engineering; add a dedicated trigger in the table controls.
{
  const controls = document.querySelector(".transport-controls");
  const saveBtn = document.createElement("button");
  saveBtn.className = "btn-add-offer";
  saveBtn.textContent = "Save preset";
  saveBtn.title = "Save the first valid row as a named preset (max 10).";
  saveBtn.addEventListener("click", savePresetFromFirstRow);
  controls.appendChild(saveBtn);
}

// Kick off
loadPresetsFromStorage();
addTransportRow(); // start with one empty row so the user can paste/edit immediately
