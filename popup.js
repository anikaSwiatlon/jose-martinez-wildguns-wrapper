// popup.js

const dot      = document.getElementById("status-dot");
const statusEl = document.getElementById("status");
const btnRead  = document.getElementById("btn-read");
const btnDl    = document.getElementById("btn-dl");
const btnSend  = document.getElementById("btn-send");
const card     = document.getElementById("preview-card");
const cfgUrl   = document.getElementById("cfg-url");
const cfgKey   = document.getElementById("cfg-key");
const btnSave  = document.getElementById("btn-save");

let scrapedPayload = null;

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Load saved settings ────────────────────────────────────────────────────

chrome.storage.local.get(["supabaseUrl", "supabaseAnonKey"], ({ supabaseUrl, supabaseAnonKey }) => {
  if (supabaseUrl)     cfgUrl.value = supabaseUrl;
  if (supabaseAnonKey) cfgKey.value = supabaseAnonKey;
});

// ── Save settings ──────────────────────────────────────────────────────────

btnSave.addEventListener("click", async () => {
  const url = cfgUrl.value.trim().replace(/\/$/, "");
  const key = cfgKey.value.trim();
  if (!url || !key) { setStatus("Fill in both fields.", "error"); return; }
  await chrome.storage.local.set({ supabaseUrl: url, supabaseAnonKey: key });
  setStatus("Settings saved.", "success");
  setTimeout(() => setStatus(""), 2000);
});

// ── Read units ─────────────────────────────────────────────────────────────

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
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
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

// ── Download JSON ──────────────────────────────────────────────────────────

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

// ── Send to Supabase ───────────────────────────────────────────────────────

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
