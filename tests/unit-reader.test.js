const { parseUnitsTable } = require("../features/unit-reader/content");

describe("parseUnitsTable", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("returns error when no lightbox table exists", () => {
    const result = parseUnitsTable();
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/lightboxTable/);
  });

  test("parses a single player with units", () => {
    document.body.innerHTML = `
      <table class="lightboxTable"><tbody>
        <tr>
          <th class="normal">
            <span class="big bold"><a href="?villageId=40285">Osada Quick Knuckles</a></span>
            <span class="bold"> – Właściciel:</span>
            <a class="lbAction" href="?userId=1456"> adam13 </a>
          </th>
        </tr>
        <tr>
          <td>
            <div class="singleUnit">
              <a href="#" name="5" id="link_unit_40285_11">
                <img alt="Farmer" title="Farmer">
                <div class="count groupCount">5</div>
              </a>
              <input id="unit_40285_11">
            </div>
          </td>
        </tr>
      </tbody></table>
    `;
    const result = parseUnitsTable();
    expect(result.error).toBeUndefined();
    expect(result.players).toHaveLength(1);
    expect(result.players[0].player).toBe("adam13");
    expect(result.players[0].village_id).toBe(40285);
    expect(result.players[0].units).toHaveLength(1);
    expect(result.players[0].units[0].unit).toBe("Farmer");
    expect(result.players[0].units[0].count).toBe(5);
    expect(result.players[0].units[0].max_count).toBe(5);
    expect(result.players[0].units[0].unit_type_id).toBe(11);
  });
});
