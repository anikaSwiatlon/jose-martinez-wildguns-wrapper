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
  // Polish alt-text variants used by the live game
  "drewno": "wood",
  "glina": "brick",
  "ruda": "ore", "żelazo": "ore", "zelazo": "ore",
  "żywność": "food", "zywnosc": "food",
  // English passthrough so synthetic test fixtures still work
  "wood": "wood", "brick": "brick", "ore": "ore", "food": "food",
};

function parseSpyReport(reportDiv) {
  if (!reportDiv) return null;

  // Spy table has class="fr_table" (same as loot); discriminate by content.
  // Real game layout (one row per section, data in the same row):
  //   <tr><th colspan="5">Wyniki szpiegowania</th></tr>
  //   <tr><th>Surowe materiały</th><td><img alt="Drewno">N</td><td><img alt="Glina">N</td>…</tr>
  //   <tr><th>Jednostki</th>      <td colspan="4">…<div class="singleUnit">…</div>…</td></tr>
  //   <tr><th>Grupy</th>          <td colspan="4">…<div class="singleUnit groupUnit">…</td></tr>
  //   <tr><th>Budynek</th>        <td colspan="4">…<div class="spyDataBuilding">…</td></tr>
  const spyTable = Array.from(reportDiv.querySelectorAll("table")).find(t => {
    if (t.id === "fr_header_table") return false;
    return t.textContent.toLowerCase().includes("wyniki szpieg");
  });
  if (!spyTable) return null;

  const raw_materials = {};
  const units = [];
  const groups = [];
  const buildings = [];

  for (const row of spyTable.querySelectorAll("tr")) {
    const header = row.querySelector("th");
    if (!header) continue;
    const hText = header.textContent.trim().toLowerCase();

    if (hText.startsWith("surowe materia")) {
      row.querySelectorAll("td").forEach(td => {
        const img = td.querySelector("img");
        const alt = img?.getAttribute("alt")?.toLowerCase().trim() || "";
        const key = RESOURCE_MAP[alt] || RESOURCE_MAP[alt.replace(/[żź]/g, "z")];
        if (!key) return;
        const val = parseInt(td.textContent.replace(/\D/g, ""), 10);
        if (!isNaN(val)) raw_materials[key] = val;
      });
    }
    else if (hText.startsWith("jednostk")) {
      row.querySelectorAll("div.singleUnit:not(.groupUnit)").forEach(div => {
        const img = div.querySelector("img:not(.groupLevel)");
        const name = img?.getAttribute("title")?.trim() || img?.getAttribute("alt")?.trim();
        const count = parseInt(div.querySelector(".count")?.textContent.replace(/\D/g, ""), 10) || 0;
        if (name && count > 0) units.push({ unit: name, count });
      });
    }
    else if (hText.startsWith("grup")) {
      row.querySelectorAll("div.singleUnit.groupUnit").forEach(div => {
        const img = div.querySelector("img:not(.groupLevel)");
        const name = img?.getAttribute("title")?.trim() || img?.getAttribute("alt")?.trim();
        const star = div.querySelector("img.groupLevel");
        const starSrc = star?.getAttribute("src") || star?.getAttribute("alt") || "";
        const lvlMatch = starSrc.match(/star_(\d+)/);
        const group_level = lvlMatch ? parseInt(lvlMatch[1], 10) : null;
        const count = parseInt(div.querySelector(".count")?.textContent.replace(/\D/g, ""), 10) || 0;
        if (name && count > 0) groups.push({ unit: name, count, group_level });
      });
    }
    else if (hText.startsWith("budyn")) {
      row.querySelectorAll("div.spyDataBuilding").forEach(div => {
        const img = div.querySelector("img");
        const name = img?.getAttribute("title")?.trim() || img?.getAttribute("alt")?.trim();
        const text = div.textContent.trim();
        const lvlMatch = text.match(/(\d+)/);
        if (name && lvlMatch) buildings.push({ building: name, level: parseInt(lvlMatch[1], 10) });
      });
    }
  }

  const hasData = Object.keys(raw_materials).length > 0
    || units.length > 0 || groups.length > 0 || buildings.length > 0;
  return hasData ? { raw_materials, units, groups, buildings } : null;
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
  // The spy table also has class="fr_table"; identify the loot table by its
  // "Łup" header. The loot row in the live game packs the <th>Łup</th> and
  // every resource <td> into one <tr>, so we just grab that tr and iterate
  // td cells (the th is skipped automatically by td selector).
  const loot = {};
  const lootTable = Array.from(report.querySelectorAll("table.fr_table")).find(t => {
    const th = t.querySelector("th");
    return th && th.textContent.trim().toLowerCase().startsWith("łup");
  });
  const lootRow = lootTable?.querySelector("tr");
  if (lootRow) {
    lootRow.querySelectorAll("td").forEach(td => {
      const img = td.querySelector("img");
      if (img) {
        const altKey = img.getAttribute("alt")?.toLowerCase().trim() || "";
        const key = RESOURCE_MAP[altKey] || RESOURCE_MAP[altKey.replace(/[żź]/g, "z")];
        if (key) loot[key] = parseInt(td.textContent.replace(/\D/g, ""), 10) || 0;
      } else {
        const parts = td.textContent.trim().split("/").map(s => parseInt(s.trim().replace(/\D/g, ""), 10));
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
