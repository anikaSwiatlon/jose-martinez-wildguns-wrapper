const fs = require("fs");
const path = require("path");
const {
  parseBattleReport,
  parseSpyReport,
  sanitizeReportDom,
  captureReport,
  extractReportId,
} = require("../features/battle-reports/content");

const FIXTURE_HTML = fs.readFileSync(
  path.join(__dirname, "fixtures", "example_report.html"),
  "utf8"
);

describe("parseBattleReport", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("returns error when no report div exists", () => {
    const result = parseBattleReport();
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/No battle report found/);
  });

  test("parses a minimal battle report", () => {
    document.body.innerHTML = `
      <div id="fightreport">
        <h1>Battle at Dawn</h1>
        <table id="fr_header_table">
          <tr><td>Data:</td><td>2026-05-18 14:30</td></tr>
          <tr><td>Szczęście:</td><td>50%</td></tr>
        </table>
        <h2><a href="?villageId=100">City A</a> <a href="?userId=1">Player1</a> Atakujący</h2>
        <div class="fightreportUnits">
          <div class="fr_unit">
            <img alt="Poncho">
            <div class="count">10<br>2</div>
          </div>
        </div>
        <h2><a href="?villageId=200">City B</a> <a href="?userId=2">Player2</a> Obrońca</h2>
        <div class="fightreportUnits">
          <div class="fr_unit">
            <img alt="Farmer">
            <div class="count">5<br>5</div>
          </div>
        </div>
        <table class="fr_table"><tr>
          <td><img alt="wood">1000</td>
          <td>500/2000</td>
        </tr></table>
      </div>
    `;
    const result = parseBattleReport();
    expect(result.error).toBeUndefined();
    expect(result.title).toBe("Battle at Dawn");
    expect(result.attacker.player).toBe("Player1");
    expect(result.attacker.units).toHaveLength(1);
    expect(result.attacker.units[0].unit).toBe("Poncho");
    expect(result.attacker.units[0].count).toBe(10);
    expect(result.attacker.units[0].losses).toBe(2);
    expect(result.defender.player).toBe("Player2");
    expect(result.loot.wood).toBe(1000);
    expect(result.loot.carried).toBe(500);
    expect(result.loot.capacity).toBe(2000);
  });

  test("report without spy section has no spy_report field", () => {
    document.body.innerHTML = `
      <div id="fightreport">
        <h1>Simple Battle</h1>
        <table id="fr_header_table"><tr><td>Data:</td><td>2026-05-18</td></tr></table>
        <h2><a href="?villageId=1">A</a> <a href="?userId=1">P1</a> Atakujący</h2>
        <div class="fightreportUnits">
          <div class="fr_unit"><img alt="Poncho"><div class="count">1<br>0</div></div>
        </div>
        <h2><a href="?villageId=2">B</a> <a href="?userId=2">P2</a> Obrońca</h2>
        <div class="fightreportUnits">
          <div class="fr_unit"><img alt="Farmer"><div class="count">1<br>0</div></div>
        </div>
      </div>
    `;
    const result = parseBattleReport();
    expect(result.spy_report).toBeUndefined();
  });

  test("includes spy_report when spy table is present", () => {
    document.body.innerHTML = `
      <div id="fightreport">
        <h1>Spy Battle</h1>
        <table id="fr_header_table"><tr><td>Data:</td><td>2026-05-18</td></tr></table>
        <h2><a href="?villageId=1">A</a> <a href="?userId=1">P1</a> Atakujący</h2>
        <div class="fightreportUnits">
          <div class="fr_unit"><img alt="Scout"><div class="count">12<br>0</div></div>
        </div>
        <h2><a href="?villageId=2">B</a> <a href="?userId=2">P2</a> Obrońca</h2>
        <div class="fightreportUnits">
          <div class="fr_unit"><img alt="Farmer"><div class="count">1<br>0</div></div>
        </div>
        <table>
          <tr><th colspan="2">Wyniki szpiegowania</th></tr>
          <tr><td colspan="2">Surowe materiały</td></tr>
          <tr><td>Drewno</td><td>8564</td></tr>
          <tr><td>Glina</td><td>5390</td></tr>
          <tr><td>Ruda</td><td>6519</td></tr>
          <tr><td>Żywność</td><td>17702</td></tr>
          <tr><td colspan="2">Jednostki</td></tr>
          <tr><td>Scouts</td><td>12</td></tr>
          <tr><td colspan="2">Grupy</td></tr>
          <tr><td colspan="2">Budynki</td></tr>
          <tr><td>Ratusz</td><td>15</td></tr>
          <tr><td>Tartak</td><td>20</td></tr>
          <tr><td>Cegielnia</td><td>18</td></tr>
        </table>
      </div>
    `;
    const result = parseBattleReport();
    expect(result.spy_report).toBeDefined();
    expect(result.spy_report.raw_materials).toEqual({
      wood: 8564, brick: 5390, ore: 6519, food: 17702,
    });
    expect(result.spy_report.units).toEqual([{ unit: "Scouts", count: 12 }]);
    expect(result.spy_report.groups).toEqual([]);
    expect(result.spy_report.buildings).toHaveLength(3);
    expect(result.spy_report.buildings[0]).toEqual({ building: "Ratusz", level: 15 });
  });
});

describe("parseSpyReport", () => {
  test("returns null for div without spy table", () => {
    document.body.innerHTML = `<div id="report"><table class="fr_table"><tr><td>loot</td></tr></table></div>`;
    const div = document.getElementById("report");
    expect(parseSpyReport(div)).toBeNull();
  });

  test("returns null for null input", () => {
    expect(parseSpyReport(null)).toBeNull();
  });
});

// ── Sanitizer + capture against the real example_report fixture ──────────────────────────

describe("sanitizeReportDom on real WildGuns fixture", () => {
  beforeEach(() => { document.body.innerHTML = FIXTURE_HTML; });

  test("strips every bis_skin_checked attribute", () => {
    const root = document.querySelector("#fightreport");
    expect(FIXTURE_HTML.match(/bis_skin_checked/g)?.length).toBeGreaterThan(100);
    const out = sanitizeReportDom(root);
    expect(out.outerHTML).not.toContain("bis_skin_checked");
  });

  test("keeps disabled unit slots for slot-by-slot comparability", () => {
    const root = document.querySelector("#fightreport");
    const out = sanitizeReportDom(root);
    expect(out.querySelectorAll(".fr_unit.disabled").length).toBeGreaterThan(0);
  });

  test("rewrites group star src to data-level attribute", () => {
    const root = document.querySelector("#fightreport");
    const out = sanitizeReportDom(root);
    const starImgs = out.querySelectorAll("img.fr_groupLevelImage");
    expect(starImgs.length).toBeGreaterThan(0);
    for (const img of starImgs) {
      expect(img.getAttribute("src")).toBeNull();
      const level = img.getAttribute("data-level");
      expect(level).toMatch(/^\d+$/);
    }
  });

  test("strips img src + title but keeps alt", () => {
    const root = document.querySelector("#fightreport");
    const out = sanitizeReportDom(root);
    const imgs = out.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img.getAttribute("src")).toBeNull();
      expect(img.getAttribute("title")).toBeNull();
      // alt is the only signal carrier for unit/resource names
      if (!img.classList.contains("rowNation")) {
        expect(img.hasAttribute("alt")).toBe(true);
      }
    }
  });

  test("removes mailReportsPrimaryRight action panel if present", () => {
    document.body.innerHTML = `
      <div id="mailReportsPrimary">
        <div id="fightreport"><h1>x</h1></div>
        <div id="mailReportsPrimaryRight"><a class="buttonlike">Attack again</a></div>
      </div>`;
    const root = document.querySelector("#fightreport");
    const out = sanitizeReportDom(root);
    expect(out.querySelector("#mailReportsPrimaryRight")).toBeNull();
    expect(out.querySelector(".buttonlike")).toBeNull();
  });

  test("returns null for null input (defensive)", () => {
    expect(sanitizeReportDom(null)).toBeNull();
  });
});

describe("extractReportId", () => {
  test("pulls report_id from URL search params", () => {
    expect(extractReportId(document, "https://x.com/?report_id=1744365")).toBe(1744365);
  });

  test("falls back to the favorites link in the DOM", () => {
    document.body.innerHTML = `
      <a href="/user.php?action=mail&report_id=999&insertIntoFavTargets=40">Fav</a>`;
    expect(extractReportId(document, "https://x.com/no-query")).toBe(999);
  });

  test("returns null when neither URL nor DOM has it", () => {
    document.body.innerHTML = "<div></div>";
    expect(extractReportId(document, "https://x.com/")).toBeNull();
  });
});

describe("captureReport on real WildGuns fixture", () => {
  beforeEach(() => {
    document.body.innerHTML = FIXTURE_HTML;
    // jsdom defaults to "about:blank" — give it a report URL so extractReportId works
    Object.defineProperty(window, "location", {
      value: new URL("https://wildguns.gameforge.com/user.php?action=mail&report_id=1744365"),
      writable: true,
    });
  });

  test("returns extracted, sanitized dom_html, and meta", () => {
    const result = captureReport();
    expect(result.error).toBeUndefined();
    expect(result.report_id).toBe(1744365);
    expect(result.extracted.attacker.player).toBe("xWojci3chX");
    expect(result.extracted.attacker.player_id).toBe(620);
    expect(result.extracted.attacker.village_id).toBe(39298);
    expect(result.extracted.defender.village_id).toBe(40946);
    expect(result.dom_html).not.toContain("bis_skin_checked");
    expect(result.dom_html).toContain("fr_unit");
    expect(result.meta.page_url).toContain("report_id=1744365");
    expect(typeof result.meta.scraped_at).toBe("string");
  });

  test("dom_html is materially smaller than the raw report", () => {
    const result = captureReport();
    expect(result.dom_html.length).toBeLessThan(FIXTURE_HTML.length * 0.85);
  });

  test("returns error when no #fightreport is on the page", () => {
    document.body.innerHTML = "<div>nothing here</div>";
    const result = captureReport();
    expect(result.error).toMatch(/No battle report/);
  });
});
