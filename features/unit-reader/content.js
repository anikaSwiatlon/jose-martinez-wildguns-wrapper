// content.js
// Runs on the Wildungs page. Parses the unit support table inside
// lightbox_content and extracts all players, their cities, units and counts.
//
// DOM structure (confirmed from DevTools):
//
// <table class="lightboxTable">
//   <tbody>
//     <tr>  ← HEADER ROW per player/city
//       <th class="normal" colspan="4">
//         <span class="big bold">
//           <a href="...villageId=40285">Osada Quick Knuckles</a>
//         </span>
//         <span class="bold"> – Właściciel:</span>
//         <a href="...userId=1456"> adam13 </a>
//       </th>
//     </tr>
//     <tr>  ← UNIT ROW(S) following the header
//       <td>
//         <div class="singleUnit">
//           <a href="#" name="5" id="link_unit_40285_11">
//             <img alt="Farmer" title="Farmer">
//             <div class="count groupCount">5</div>
//           </a>
//           <input id="unit_40285_11" ...>   ← encodes villageId_unitTypeId
//         </div>
//       </td>
//       ...more <td>s
//     </tr>
//     <tr>  ← next player header ...
//   </tbody>
// </table>

function parseUnitsTable() {
  const table = document.querySelector("table.lightboxTable");
  if (!table) {
    return { error: "Could not find table.lightboxTable. Open the unit support lightbox first." };
  }

  const rows = Array.from(table.querySelectorAll("tbody > tr"));
  if (rows.length === 0) {
    return { error: "Table found but contains no rows." };
  }

  const players = [];
  let currentPlayer = null;

  for (const row of rows) {
    // ── Header row: new player / city block ───────────────────────────────
    const headerTh = row.querySelector("th.normal");
    if (headerTh) {
      const cityAnchor = headerTh.querySelector("span.big.bold a");
      const cityName   = cityAnchor ? cityAnchor.textContent.trim() : "unknown";

      const villageIdMatch = cityAnchor?.getAttribute("href")?.match(/villageId=(\d+)/);
      const villageId      = villageIdMatch ? parseInt(villageIdMatch[1], 10) : null;

      // Player anchor is the lbAction link NOT inside span.big
      const allAnchors   = Array.from(headerTh.querySelectorAll("a.lbAction"));
      const playerAnchor = allAnchors.find(a => !a.closest("span.big"));
      const playerName   = playerAnchor ? playerAnchor.textContent.trim() : "unknown";

      const userIdMatch = playerAnchor?.getAttribute("href")?.match(/userId=(\d+)/);
      const userId      = userIdMatch ? parseInt(userIdMatch[1], 10) : null;

      currentPlayer = {
        player:     playerName,
        user_id:    userId,
        city:       cityName,
        village_id: villageId,
        units:      [],
      };
      players.push(currentPlayer);
      continue;
    }

    // ── Unit row: collect all singleUnit cells ────────────────────────────
    if (!currentPlayer) continue;

    row.querySelectorAll("div.singleUnit").forEach(div => {
      const img = div.querySelector("img");
      if (!img) return;

      const unitName   = img.getAttribute("alt")?.trim()
                      || img.getAttribute("title")?.trim()
                      || "unknown";

      const countEl    = div.querySelector("div.count.groupCount");
      const count      = countEl
        ? parseInt(countEl.textContent.replace(/\D/g, ""), 10)
        : 0;

      // input id = "unit_{villageId}_{unitTypeId}"
      const input      = div.querySelector("input[id^='unit_']");
      const idParts    = input?.id?.match(/unit_(\d+)_(\d+)/);
      const unitTypeId = idParts ? parseInt(idParts[2], 10) : null;
      const unitId     = input?.id ?? null;   // e.g. "unit_38594_21"

      // <a name="5"> holds the max returnable count for this unit group
      const linkAnchor = div.querySelector("a[id^='link_unit_']");
      const maxCount   = linkAnchor
        ? parseInt(linkAnchor.getAttribute("name") || "0", 10)
        : count;

      currentPlayer.units.push({
        unit:         unitName,
        unit_id:      unitId,
        count:        count,
        max_count:    maxCount,
        unit_type_id: unitTypeId,
      });
    });
  }

  if (players.length === 0) {
    return { error: "No player blocks found. Is the unit support panel open?" };
  }

  return {
    players,
    total_players: players.length,
    total_units:   players.reduce((sum, p) => sum + p.units.length, 0),
    scraped_at:    new Date().toISOString(),
    page_url:      window.location.href,
  };
}

// ── Node/Jest export for testing ──────────────────────────────────────────
if (typeof module !== "undefined" && module.exports) {
  module.exports = { parseUnitsTable };
}

// ── Message listener ───────────────────────────────────────────────────────
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== "SCRAPE_UNITS") return;

    const result = parseUnitsTable();

    if (result.error) {
      sendResponse({ success: false, error: result.error });
      return;
    }

    sendResponse({ success: true, data: result });
  });
}
