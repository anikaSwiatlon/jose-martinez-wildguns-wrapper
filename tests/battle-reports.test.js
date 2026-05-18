const { parseBattleReport, parseSpyReport } = require("../features/battle-reports/content");

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
