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
          <th>Łup</th>
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
    // Mirrors the live game layout: all resources in one row, units/groups/buildings
    // each crammed into a single <td colspan="4"> with their own div structures.
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
        <table class="fr_table">
          <tr><th colspan="5">Wyniki szpiegowania</th></tr>
          <tr>
            <th>Surowe materiały</th>
            <td><img alt="Drewno">8564</td>
            <td><img alt="Glina">5390</td>
            <td><img alt="Żelazo">6519</td>
            <td><img alt="Żywność">17702</td>
          </tr>
          <tr>
            <th>Jednostki</th>
            <td colspan="4">
              <div class="singleUnit"><img title="Scouts"><div class="count">12</div></div>
            </td>
          </tr>
          <tr><th>Grupy</th><td colspan="4"></td></tr>
          <tr>
            <th>Budynek</th>
            <td colspan="4">
              <div class="spyDataBuilding"><img title="Ratusz">Poziom 15</div>
              <div class="spyDataBuilding"><img title="Tartak">Poziom 20</div>
              <div class="spyDataBuilding"><img title="Cegielnia">Poziom 18</div>
            </td>
          </tr>
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

// ── Deep-extraction tests driven by the actual example_report.docx the user
//    shared — every assertion below maps to a specific value visible in that
//    report (xWojci3chX attacking Emeryci z Coltami 9 F, 19.05.26 23:52).
describe("parseBattleReport on real WildGuns fixture", () => {
  let result;
  beforeAll(() => {
    document.body.innerHTML = FIXTURE_HTML;
    result = parseBattleReport();
  });

  test("extracts the h1 title verbatim", () => {
    expect(result.title).toBe("xWojci3chX atakuje Emeryci z Coltami 9 F (grabież)");
  });

  test("extracts date / luck / loyalty from #fr_header_table", () => {
    expect(result.date).toBe("19.05.26 23:52");
    expect(result.luck).toBe("32.1 %");
    expect(result.loyalty).toBe("100 %");
  });

  test("extracts attacker identity (player, player_id, city, village_id)", () => {
    expect(result.attacker).toMatchObject({
      player:     "xWojci3chX",
      player_id:  620,
      city:       "001 xWojci3chX",
      village_id: 39298,
    });
  });

  test("extracts defender identity", () => {
    expect(result.defender).toMatchObject({
      player_id:  350,
      village_id: 40946,
      city:       "Emeryci z Coltami 9 F",
    });
  });

  test("extracts the lone normal attacker unit (Odkrywca 9 / 1 lost)", () => {
    const odkrywca = result.attacker.units.find(u => u.unit === "Odkrywca" && !u.is_group);
    expect(odkrywca).toEqual({ unit: "Odkrywca", count: 9, losses: 1, is_group: false });
  });

  test("extracts all 20 attacker groups with their star levels", () => {
    const groups = result.attacker.units.filter(u => u.is_group);
    expect(groups).toHaveLength(20);
    // Every attacker group is 50 strong with 25 lost in this report
    expect(groups.every(g => g.count === 50 && g.losses === 25)).toBe(true);
    // Group-level distribution: 18 at star_5, 2 at star_3
    const levelCounts = groups.reduce((acc, g) => {
      acc[g.group_level] = (acc[g.group_level] ?? 0) + 1;
      return acc;
    }, {});
    expect(levelCounts).toEqual({ 5: 18, 3: 2 });
  });

  test("extracts both engaged defender units (Poncho 95/48, Odkrywca 20/10)", () => {
    expect(result.defender.units).toEqual([
      { unit: "Poncho",   count: 95, losses: 48, is_group: false },
      { unit: "Odkrywca", count: 20, losses: 10, is_group: false },
    ]);
  });

  test("extracts loot: 1753 ore, zeros elsewhere, carried/capacity 1753/50000", () => {
    expect(result.loot).toEqual({
      wood:     0,
      brick:    0,
      ore:      1753,
      food:     0,
      carried:  1753,
      capacity: 50000,
    });
  });

  test("includes a spy_report with the correct raw_materials", () => {
    expect(result.spy_report).toBeDefined();
    expect(result.spy_report.raw_materials).toEqual({
      wood:  1649,
      brick: 604,
      ore:   1829,
      food:  260,
    });
  });

  test("spy_report.groups contains many Zawadiaka entries with star levels", () => {
    expect(result.spy_report.groups.length).toBeGreaterThan(20);
    const zawadiakas = result.spy_report.groups.filter(g => g.unit === "Zawadiaka");
    expect(zawadiakas.length).toBeGreaterThan(10);
    // Every group entry must have a numeric group_level
    expect(result.spy_report.groups.every(g => typeof g.group_level === "number")).toBe(true);
  });

  test("spy_report.buildings exists and includes Akademia + Stajnia from the fixture", () => {
    expect(result.spy_report.buildings.length).toBeGreaterThan(0);
    const names = result.spy_report.buildings.map(b => b.building);
    expect(names).toContain("Akademia");
    expect(names).toContain("Stajnia");
    const akademia = result.spy_report.buildings.find(b => b.building === "Akademia");
    expect(akademia.level).toBe(10);
    const stajnia = result.spy_report.buildings.find(b => b.building === "Stajnia");
    expect(stajnia.level).toBe(1);
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
