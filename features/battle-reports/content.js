// content.js — WildGuns battle report scraper
// Injected on wildguns.gameforge.com pages.
//
// DOM structure (confirmed from HTML inspection):
//
// Normal unit (present):
//   <div class="fr_unit">
//     <img alt="Poncho">
//     <div class="count">1<br>1</div>
//   </div>
//
// Group unit (stacked / upgraded):
//   <div class="fr_unit group">
//     <img alt="Kabalieros">
//     <div class="count">50<br>0</div>
//     <img class="fr_groupLevelImage" src="star_2.gif" alt="star_2.gif">
//   </div>
//   The star filename encodes the group level: star_2.gif → level 2.
//
// Disabled (absent):
//   <div class="fr_unit disabled"> ... </div>

// ── Spy report parser (espionage results table) ──────────────────────────────────────────────
// The spy report appears as a separate table inside #fightreport when the
// attacking army included scouts that broke through. It contains sections
// for raw materials, units, groups, and buildings — identified by Polish headers.

const RESOURCE_MAP = {
  "drewno": "wood", "glina": "brick", "ruda": "ore",
  "żywność": "food", "zywnosc": "food",
};

function parseSpyReport(reportDiv) {
  if (!reportDiv) return null;

  const tables = reportDiv.querySelectorAll("table");
  let spyTable = null;
  for (const t of tables) {
    if (t.classList.contains("fr_table")) continue;
    if (t.id === "fr_header_table") continue;
    const text = t.textContent.toLowerCase();
    if (text.includes("szpiegow") || text.includes("szpieg") || text.includes("surowe materia")) {
      spyTable = t;
      break;
    }
  }
  if (!spyTable) return null;

  const rows = Array.from(spyTable.querySelectorAll("tr"));
  const raw_materials = {};
  const units = [];
  const groups = [];
  const buildings = [];

  let currentSection = null;

  for (const row of rows) {
    const headerCell = row.querySelector("th, td[colspan]");
    if (headerCell) {
      const hText = headerCell.textContent.trim().toLowerCase();
      if (hText.includes("surowe materia")) { currentSection = "resources"; continue; }
      if (hText.includes("jednostk"))       { currentSection = "units";     continue; }
      if (hText.includes("grup"))           { currentSection = "groups";    continue; }
      if (hText.includes("budyn"))          { currentSection = "buildings"; continue; }
    }

    const cells = row.querySelectorAll("td");
    if (cells.length < 2) continue;

    const label = cells[0].textContent.trim();
    const value = cells[1].textContent.trim();

    if (currentSection === "resources") {
      const key = RESOURCE_MAP[label.toLowerCase()];
      if (key) raw_materials[key] = parseInt(value.replace(/\D/g, ""), 10) || 0;
    } else if (currentSection === "units" || currentSection === "groups") {
      const count = parseInt(value.replace(/\D/g, ""), 10) || 0;
      if (label && count > 0) {
        const entry = { unit: label, count };
        (currentSection === "units" ? units : groups).push(entry);
      }
    } else if (currentSection === "buildings") {
      const level = parseInt(value.replace(/\D/g, ""), 10) || 0;
      if (label) buildings.push({ building: label, level });
    }
  }

  const hasData = Object.keys(raw_materials).length > 0
    || units.length > 0 || groups.length > 0 || buildings.length > 0;
  if (!hasData) return null;

  return { raw_materials, units, groups, buildings };
}

function parseBattleReport() {
  const report = document.querySelector("div#fightreport");
  if (!report) {
    return { error: "No battle report found. Open a WildGuns battle report first." };
  }

  // ── Metadata ────────────────────────────────────────────────────────────────────────
  const headerRows = report.querySelectorAll("#fr_header_table tr");
  let date = null, luck = null, loyalty = null;
  headerRows.forEach(row => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) return;
    const label = cells[0].textContent.trim().toLowerCase();
    const value = cells[1].textContent.trim();
    if (label.includes("data"))         date    = value;
    else if (label.includes("szcz"))    luck    = value;
    else if (label.includes("lojalno")) loyalty = value;
  });

  // ── Player block from h2 ───────────────────────────────────────────────────────────────
  function parsePlayerBlock(h2) {
    if (!h2) return null;
    let player = null, playerId = null, city = null, villageId = null;
    h2.querySelectorAll("a").forEach(a => {
      const href = a.getAttribute("href") || "";
      const um = href.match(/userId=(\d+)/);
      const vm = href.match(/villageId=(\d+)/);
      if (um) { player = a.textContent.trim(); playerId = parseInt(um[1], 10); }
      if (vm) { city   = a.textContent.trim(); villageId = parseInt(vm[1], 10); }
    });
    return { player, player_id: playerId, city, village_id: villageId };
  }

  // ── Unit parser — handles normal and group units ────────────────────────────────────────
  function parseUnits(fightreportUnitsDiv) {
    if (!fightreportUnitsDiv) return [];
    const units = [];

    fightreportUnitsDiv.querySelectorAll("div.fr_unit").forEach(div => {
      if (div.classList.contains("disabled")) return;

      const isGroup = div.classList.contains("group");

      const img = div.querySelector("img:not(.fr_groupLevelImage)");
      if (!img) return;

      const unitName = img.getAttribute("alt")?.trim()
                    || img.getAttribute("title")?.trim()
                    || "unknown";

      // count div: "50<br>0" → count=50, losses=0
      const countDiv = div.querySelector("div.count");
      let count = 0, losses = 0;
      if (countDiv) {
        const parts = countDiv.innerHTML
          .replace(/<br\s*\/?>/gi, "\n")
          .split("\n")
          .map(s => s.trim())
          .filter(Boolean);
        count  = parseInt(parts[0], 10) || 0;
        losses = parseInt(parts[1], 10) || 0;
      }

      if (count === 0) return;

      // Group level: extract number from star_2.gif → 2
      let groupLevel = null;
      if (isGroup) {
        const starImg = div.querySelector("img.fr_groupLevelImage");
        if (starImg) {
          const src   = starImg.getAttribute("src") || starImg.getAttribute("alt") || "";
          const match = src.match(/star_(\d+)/);
          groupLevel  = match ? parseInt(match[1], 10) : null;
        }
        groupLevel = groupLevel ?? 1;
      }

      const entry = { unit: unitName, count, losses, is_group: isGroup };
      if (isGroup) entry.group_level = groupLevel;

      units.push(entry);
    });

    return units;
  }

  // ── Find the fightreportUnits div after a given h2 ────────────────────────────────────
  function nextFightreportUnits(h2) {
    let el = h2?.nextElementSibling;
    while (el) {
      if (el.tagName === "BR") { el = el.nextElementSibling; continue; }
      if (el.classList?.contains("fightreportUnits")) return el;
      if (el.tagName === "H2") return null;
      el = el.nextElementSibling;
    }
    return null;
  }

  const h2s        = Array.from(report.querySelectorAll("h2"));
  const attackerH2 = h2s.find(h => h.textContent.includes("Atakuj"));
  const defenderH2 = h2s.find(h => h.textContent.includes("Obro"));

  const attacker = parsePlayerBlock(attackerH2);
  const defender = parsePlayerBlock(defenderH2);
  if (attacker) attacker.units = parseUnits(nextFightreportUnits(attackerH2));
  if (defender) defender.units = parseUnits(nextFightreportUnits(defenderH2));

  // ── Loot ───────────────────────────────────────────────────────────────────────────
  const loot = {};
  const lootRow = report.querySelector("table.fr_table tr");
  if (lootRow) {
    lootRow.querySelectorAll("td").forEach(td => {
      const img = td.querySelector("img");
      if (img) {
        const res = img.getAttribute("alt")?.trim();
        if (res) loot[res] = parseInt(td.textContent.trim(), 10) || 0;
      } else {
        const parts = td.textContent.trim().split("/").map(s => parseInt(s.trim(), 10));
        if (parts.length === 2 && !isNaN(parts[0])) {
          loot.carried = parts[0];
          loot.capacity = parts[1];
        }
      }
    });
  }

  // ── Spy report (espionage results) ──────────────────────────────────────────────
  const spyReport = parseSpyReport(report);

  // ── Title ──────────────────────────────────────────────────────────────────────────
  const h1    = report.querySelector("h1");
  const title = h1
    ? Array.from(h1.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim())
        .join(" ").trim()
    : null;

  if (!attacker && !defender) {
    return { error: "Could not parse attacker or defender from this report." };
  }

  const result = {
    title, date, luck, loyalty,
    attacker, defender, loot,
    page_url:   typeof window !== "undefined" ? window.location.href : "",
    scraped_at: new Date().toISOString(),
  };
  if (spyReport) result.spy_report = spyReport;
  return result;
}

// ── DOM sanitizer for the stored copy ─────────────────────────────────────────────────────
//
// Strips browser-injected attributes (bis_skin_checked from Bitdefender/Avira),
// live-UI controls (re-attack buttons), and image sources that won't resolve
// outside a logged-in session. Preserves:
//   - disabled unit slots (slot-by-slot comparability across reports)
//   - fr_unitRowDescriptor (carries XP gained per side)
//   - group star level (rewritten from src="star_5.gif" to data-level="5")
//
// Returns a NEW element, leaving the live DOM untouched.

const REPORT_ROOT_SELECTOR = "div#fightreport";

function sanitizeReportDom(rootEl) {
  if (!rootEl) return null;
  const clone = rootEl.cloneNode(true);
  const doc = clone.ownerDocument;

  // Strip the live-UI action panel (re-attack / favorite buttons)
  clone.querySelectorAll("#mailReportsPrimaryRight, .buttonlike").forEach(el => el.remove());

  // Rewrite group level images: src="...star_5.gif" → data-level="5", then drop src.
  clone.querySelectorAll("img.fr_groupLevelImage").forEach(img => {
    const src = img.getAttribute("src") || img.getAttribute("alt") || "";
    const m = src.match(/star_(\d+)/);
    if (m) img.setAttribute("data-level", m[1]);
    img.removeAttribute("src");
    img.removeAttribute("title");
  });

  // For every other img: drop src + title (alt stays, it's the unit/resource name)
  clone.querySelectorAll("img:not(.fr_groupLevelImage)").forEach(img => {
    img.removeAttribute("src");
    img.removeAttribute("title");
  });

  // Walk every element, drop noise attributes
  const NOISE_ATTRS = ["bis_skin_checked", "onclick", "style"];
  const walker = doc ? doc.createTreeWalker(clone, 1 /* NodeFilter.SHOW_ELEMENT */) : null;
  if (walker) {
    let node = walker.currentNode;
    while (node) {
      for (const attr of NOISE_ATTRS) node.removeAttribute?.(attr);
      node = walker.nextNode();
    }
  } else {
    clone.querySelectorAll("*").forEach(el => {
      for (const attr of NOISE_ATTRS) el.removeAttribute(attr);
    });
  }
  // The walker skips the root itself in some implementations — sweep it too.
  for (const attr of NOISE_ATTRS) clone.removeAttribute?.(attr);

  return clone;
}

// ── Report ID + page URL helpers ──────────────────────────────────────────────────────────
//
// WildGuns embeds the report ID in two places:
//   1. URL: ...mailaction=reports&report_id=1744365
//   2. The "Add to favorites" link: insertIntoFavTargets=...&report_id=1744365
// We try URL first, fall back to the DOM link, then null.

function extractReportId(rootDocument, pageUrl) {
  try {
    const url = new URL(pageUrl);
    const fromQuery = url.searchParams.get("report_id");
    if (fromQuery) return parseInt(fromQuery, 10);
  } catch { /* malformed URL — fall through to DOM lookup */ }

  const link = rootDocument?.querySelector?.('a[href*="report_id="]');
  if (link) {
    const m = link.getAttribute("href").match(/report_id=(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

// ── captureReport — entry point for the new one-click Save flow ───────────────────────────
//
// Returns:
//   { report_id, dom_html, extracted, meta }
// Or { error } if the page doesn't contain a parseable report.

function captureReport() {
  const doc = typeof document !== "undefined" ? document : null;
  if (!doc) return { error: "captureReport requires a document context." };

  const root = doc.querySelector(REPORT_ROOT_SELECTOR);
  if (!root) return { error: "No battle report found. Open a WildGuns battle report first." };

  const extracted = parseBattleReport();
  if (extracted.error) return { error: extracted.error };

  const sanitized = sanitizeReportDom(root);
  const dom_html = sanitized ? sanitized.outerHTML : "";

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const reportId = extractReportId(doc, pageUrl)
    ?? extracted.attacker?.village_id ?? null; // fallback to attacker village if no report_id (rare)

  return {
    report_id: reportId,
    dom_html,
    extracted,
    meta: {
      page_url: pageUrl,
      scraped_at: new Date().toISOString(),
      extension_version: (typeof chrome !== "undefined" && chrome.runtime?.getManifest)
        ? chrome.runtime.getManifest().version
        : null,
    },
  };
}

// ── Node/Jest export for testing ──────────────────────────────────────────────────────────────
if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseBattleReport, parseSpyReport, sanitizeReportDom, captureReport, extractReportId };
}

// ── Message listener ───────────────────────────────────────────────────────────────────────
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "SCRAPE_WILDGUNS") {
      const result = parseBattleReport();
      if (result.error) { sendResponse({ success: false, error: result.error }); return; }
      sendResponse({ success: true, data: result });
      return;
    }
    if (message.type === "CAPTURE_REPORT") {
      const result = captureReport();
      if (result.error) { sendResponse({ success: false, error: result.error }); return; }
      sendResponse({ success: true, data: result });
      return;
    }
  });
}
