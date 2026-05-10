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

  return {
    title, date, luck, loyalty,
    attacker, defender, loot,
    page_url:   window.location.href,
    scraped_at: new Date().toISOString(),
  };
}

// ── Message listener ───────────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "SCRAPE_WILDGUNS") return;
  const result = parseBattleReport();
  if (result.error) { sendResponse({ success: false, error: result.error }); return; }
  sendResponse({ success: true, data: result });
});
