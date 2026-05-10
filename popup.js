// popup.js

const DEFAULT_OFFERS = [
  { offeringType: "wood",  offeringAmount: 1000, wantingType: "food", wantingAmount: 1700, count: 3 },
  { offeringType: "brick", offeringAmount: 1000, wantingType: "food", wantingAmount: 1700, count: 3 },
  { offeringType: "ore",   offeringAmount: 1000, wantingType: "food", wantingAmount: 1700, count: 3 },
];
const DEFAULT_RUNTIME = 12;

const dot        = document.getElementById("status-dot");
const statusEl   = document.getElementById("status");
const btnRead    = document.getElementById("btn-read");
const btnDl      = document.getElementById("btn-dl");
const btnSend    = document.getElementById("btn-send");
const card       = document.getElementById("preview-card");
const cfgUrl     = document.getElementById("cfg-url");
const cfgKey     = document.getElementById("cfg-key");
const cfgLicense = document.getElementById("cfg-license");
const cfgOffers  = document.getElementById("cfg-offers");
const cfgRuntime = document.getElementById("cfg-runtime");
const btnSave    = document.getElementById("btn-save");
const btnMarket  = document.getElementById("btn-market");

let scrapedPayload = null;

// ── Helpers ────────────────────────────────────────────────────────────────────────

function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className   = type;
}

function setDot(state) {
  dot.className = `dot ${state}`;
}

function renderPreview(data) {
  card.innerHTML = data.players.map(p => `
    <div class="player-block">
      <div class="player-name">
        <span>${p.player}</span>
        <span class="player-city">${p.city} <span class="village-id">#${p.village_id}</span></span>
      </div>
      <div class="unit-list">
        ${p.units.map(u => `
          <div class="unit-row">
            <span>${u.unit} <span class="unit-id">${u.unit_id ?? ""}</span></span>
            <span class="count">${u.count.toLocaleString()} / ${u.max_count.toLocaleString()}</span>
          </div>`).join("")}
      </div>
    </div>`).join("");
  card.classList.add("visible");
}

// ── Load saved settings ───────────────────────────────────────────────────────────────

chrome.storage.local.get(
  ["supabaseUrl", "supabaseAnonKey", "licenseKey", "marketOffers", "marketRuntime"],
  ({ supabaseUrl, supabaseAnonKey, licenseKey, marketOffers, marketRuntime }) => {
    if (supabaseUrl)     cfgUrl.value     = supabaseUrl;
    if (supabaseAnonKey) cfgKey.value     = supabaseAnonKey;
    if (licenseKey)      cfgLicense.value = licenseKey;
    cfgOffers.value  = JSON.stringify(marketOffers ?? DEFAULT_OFFERS, null, 2);
    cfgRuntime.value = marketRuntime ?? DEFAULT_RUNTIME;
    checkLicense(supabaseUrl, licenseKey);
    checkActiveTab();
  }
);

// ── Save settings ──────────────────────────────────────────────────────────────────────

btnSave.addEventListener("click", async () => {
  const url     = cfgUrl.value.trim().replace(/\/$/, "");
  const key     = cfgKey.value.trim();
  const license = cfgLicense.value.trim();
  if (!url || !key) { setStatus("Fill in both fields.", "error"); return; }
  const offers  = parseOffersInput(cfgOffers.value);
  const runtime = parseInt(cfgRuntime.value, 10) || DEFAULT_RUNTIME;
  await chrome.storage.local.set({
    supabaseUrl: url, supabaseAnonKey: key, licenseKey: license,
    marketOffers: offers, marketRuntime: runtime,
  });
  setStatus("Settings saved.", "success");
  checkLicense(url, license);
  setTimeout(() => setStatus(""), 2000);
});

// ── Read units ────────────────────────────────────────────────────────────────────────

btnRead.addEventListener("click", async () => {
  setDot("loading");
  setStatus("Reading page…");
  btnRead.disabled = true;
  btnDl.disabled   = true;
  btnSend.disabled = true;
  card.classList.remove("visible");
  scrapedPayload = null;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["features/unit-reader/content.js"] });
  } catch { /* already injected */ }

  chrome.tabs.sendMessage(tab.id, { type: "SCRAPE_UNITS" }, (response) => {
    btnRead.disabled = false;

    if (chrome.runtime.lastError || !response) {
      setStatus("No response. Is the unit support panel open?", "error");
      setDot("error");
      return;
    }
    if (!response.success) {
      setStatus(response.error ?? "Scraping failed.", "error");
      setDot("error");
      return;
    }

    scrapedPayload = response.data;
    renderPreview(response.data);

    const { total_players, total_units } = response.data;
    setStatus(`${total_players} player(s), ${total_units} unit type(s) found.`, "success");
    setDot("ready");
    btnDl.disabled   = false;
    btnSend.disabled = false;
  });
});

// ── Download JSON ──────────────────────────────────────────────────────────────────────

btnDl.addEventListener("click", () => {
  if (!scrapedPayload) return;
  const json = JSON.stringify(scrapedPayload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const ts   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  a.href     = url;
  a.download = `wildungs-units-${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus("JSON downloaded.", "success");
  setTimeout(() => setStatus(`${scrapedPayload.total_players} player(s) ready to send.`, "success"), 1500);
});

// ── License gate (Send Back Support) ─────────────────────────────────────────

async function checkLicense(supabaseUrl, licenseKey) {
  const container = document.getElementById("send-back-container");
  container.innerHTML = "";
  if (!supabaseUrl || !licenseKey) return;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/license-gate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ licenseKey }),
    });
    if (!res.ok) return;
    const html = (await res.text()).trim();
    if (!html) return;

    container.innerHTML = html;
    document.getElementById("btn-sendback")
      ?.addEventListener("click", handleSendBack);
  } catch {
    // Network error — feature stays invisible
  }
}

async function handleSendBack() {
  const input    = document.getElementById("village-ids-input");
  const statusEl = document.getElementById("sendback-status");
  const btn      = document.getElementById("btn-sendback");
  const raw      = input?.value.trim() ?? "";

  if (!raw) {
    statusEl.textContent = "Enter at least one village ID.";
    statusEl.className   = "error";
    return;
  }

  const villageIds = raw.split(",").map(s => s.trim()).filter(Boolean);
  statusEl.textContent = `Sending back for ${villageIds.length} village(s)…`;
  statusEl.className   = "loading";
  btn.disabled = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func:   sendBackSupportOnPage,
      args:   [villageIds],
    });
    const result = results?.[0]?.result;
    if (result?.success) {
      statusEl.textContent = result.message ?? "Done.";
      statusEl.className   = "success";
    } else {
      statusEl.textContent = result?.error ?? "Unknown error.";
      statusEl.className   = "error";
    }
  } catch (e) {
    statusEl.textContent = e.message;
    statusEl.className   = "error";
  } finally {
    btn.disabled = false;
  }
}

async function sendBackSupportOnPage(villageIds) {
  var token = window.userToken;
  if (!token) return { success: false, error: "userToken not found on page." };

  var origGoHome  = window.goHome;
  var origReload  = window.location.reload.bind(window.location);
  window.goHome           = function () {};
  window.location.reload  = function () {};

  try {
    for (var v = 0; v < villageIds.length; v++) {
      var vid = String(villageIds[v]).trim();

      // Fill each unit field to its max (stored in the link anchor's name attr)
      var uf = document.getElementsByClassName("unitField_" + vid);
      for (var i = 0; i < uf.length; i++) {
        var link = document.getElementById("link_" + uf[i].id);
        if (link) uf[i].value = link.name;
      }

      // Build sendstring from populated fields
      var sendstring = "&sendunitsType=back";
      var formValues = document.getElementsByClassName("toJs " + vid);
      for (var j = 0; j < formValues.length; j++) {
        var f = formValues[j];
        if (f.value && (f.type !== "checkbox" || f.checked)) {
          sendstring += "&" + f.name + "=" + encodeURIComponent(f.value);
        }
      }

      var url = "ajax_interface.php"
        + "?ajax_action=sendBackSupport"
        + "&whosetroops=other"
        + sendstring
        + "&isgoldmine=0"
        + "&userToken=" + encodeURIComponent(token);

      var resp = await fetch(url, { credentials: "include" });
      if (!resp.ok) {
        return { success: false, error: "HTTP " + resp.status + " for village " + vid };
      }
    }
    return { success: true, message: "Sent back for " + villageIds.length + " village(s)." };
  } finally {
    window.goHome          = origGoHome;
    window.location.reload = origReload;
  }
}

// ── Market Offers ──────────────────────────────────────────────────────────────────────

async function checkActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isGame = tab?.url &&
    (tab.url.includes("wildungs.com") || tab.url.includes("wildguns.gameforge.com"));
  btnMarket.disabled = !isGame;
}

btnMarket.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { marketOffers, marketRuntime } = await chrome.storage.local.get(["marketOffers", "marketRuntime"]);
  const offers  = marketOffers  ?? DEFAULT_OFFERS;
  const runtime = marketRuntime ?? DEFAULT_RUNTIME;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func:   runMarketOffers,
      args:   [offers, runtime],
    });
  } catch (e) {
    setStatus("Market offers failed: " + e.message, "error");
  }
});

function parseOffersInput(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch { /* fall through */ }
  setStatus("Invalid offers JSON — using defaults.", "error");
  setTimeout(() => setStatus(""), 2500);
  return DEFAULT_OFFERS;
}

function runMarketOffers(offers, runtime) {
  var params = new URLSearchParams(window.location.search);
  var userToken = params.get("userToken");
  if (!userToken) {
    console.error("userToken not found in page URL.");
    return;
  }

  var tasks = [];
  for (var o = 0; o < offers.length; o++) {
    var offer = offers[o];
    for (var i = 0; i < offer.count; i++) {
      tasks.push({ offer: offer, index: i + 1 });
    }
  }

  console.log("Sending " + tasks.length + " total requests... token=" + userToken.slice(0, 6) + "****");

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

// ── Send to Supabase ───────────────────────────────────────────────────────────────────

btnSend.addEventListener("click", async () => {
  if (!scrapedPayload) return;

  const { supabaseUrl, supabaseAnonKey } = await chrome.storage.local.get([
    "supabaseUrl", "supabaseAnonKey",
  ]);

  if (!supabaseUrl || !supabaseAnonKey) {
    setStatus("Configure Supabase settings first.", "error");
    setDot("error");
    document.getElementById("settings-panel").open = true;
    return;
  }

  setDot("loading");
  setStatus("Sending…");
  btnSend.disabled = true;
  btnRead.disabled = true;

  chrome.runtime.sendMessage(
    { type: "SEND_TO_SUPABASE", payload: scrapedPayload },
    (response) => {
      btnRead.disabled = false;
      if (!response?.success) {
        setStatus(`Failed: ${response?.error ?? "Unknown error."}`, "error");
        setDot("error");
        btnSend.disabled = false;
        return;
      }
      setStatus("Saved to Supabase!", "success");
      setDot("ready");
    }
  );
});
