const {
  MAX_PRESETS,
  validatePreset,
  normalizePreset,
  addPresetWithCap,
  removePreset,
  findPreset,
  loadPresets,
  savePresets,
} = require("../lib/presets-store");

function makePreset(overrides = {}) {
  return {
    name: "Daily food → capital",
    targetX: 500,
    targetY: 500,
    amountWood: 0,
    amountBrick: 0,
    amountOre: 0,
    amountFood: 1000,
    ...overrides,
  };
}

describe("validatePreset", () => {
  test("returns null for a valid preset", () => {
    expect(validatePreset(normalizePreset(makePreset()))).toBeNull();
  });

  test("rejects empty name", () => {
    expect(validatePreset(normalizePreset(makePreset({ name: "   " })))).toMatch(/name/);
  });

  test("rejects negative coords", () => {
    expect(validatePreset(normalizePreset(makePreset({ targetX: -5 })))).toMatch(/targetX/);
  });

  test("rejects all-zero amounts", () => {
    const p = normalizePreset(makePreset({ amountWood: 0, amountBrick: 0, amountOre: 0, amountFood: 0 }));
    expect(validatePreset(p)).toMatch(/at least one/);
  });

  test("rejects non-integer amounts (validates raw object, skipping normalization)", () => {
    expect(validatePreset({ ...makePreset(), amountWood: "not a number" })).toMatch(/amountWood/);
    expect(validatePreset({ ...makePreset(), amountBrick: 1.5 })).toMatch(/amountBrick/);
  });
});

describe("normalizePreset", () => {
  test("coerces string numbers to integers", () => {
    const p = normalizePreset({
      name: "x", targetX: "10", targetY: "20",
      amountWood: "100", amountBrick: "200", amountOre: "0", amountFood: "0",
    });
    expect(p.targetX).toBe(10);
    expect(p.targetY).toBe(20);
    expect(p.amountWood).toBe(100);
  });

  test("trims the name", () => {
    expect(normalizePreset(makePreset({ name: "  spaced  " })).name).toBe("spaced");
  });

  test("auto-generates id and createdAt if not supplied", () => {
    const p = normalizePreset(makePreset());
    expect(typeof p.id).toBe("string");
    expect(p.id.length).toBeGreaterThan(0);
    expect(typeof p.createdAt).toBe("number");
  });

  test("preserves supplied id and createdAt", () => {
    const p = normalizePreset({ ...makePreset(), id: "fixed-id", createdAt: 12345 });
    expect(p.id).toBe("fixed-id");
    expect(p.createdAt).toBe(12345);
  });
});

describe("addPresetWithCap", () => {
  test("appends below the cap without dropping anything", () => {
    const { presets, dropped } = addPresetWithCap([], makePreset({ name: "a" }));
    expect(presets).toHaveLength(1);
    expect(dropped).toBeNull();
  });

  test("evicts the oldest by createdAt when the cap is exceeded", () => {
    let list = [];
    for (let i = 0; i < MAX_PRESETS; i++) {
      list = addPresetWithCap(list, makePreset({ name: `p${i}`, createdAt: i })).presets;
    }
    expect(list).toHaveLength(MAX_PRESETS);
    const { presets, dropped } = addPresetWithCap(list, makePreset({ name: "newest", createdAt: 999 }));
    expect(presets).toHaveLength(MAX_PRESETS);
    expect(dropped.name).toBe("p0"); // createdAt=0 is the oldest
    expect(presets.find(p => p.name === "newest")).toBeDefined();
    expect(presets.find(p => p.name === "p0")).toBeUndefined();
  });

  test("throws on invalid preset before mutating", () => {
    const list = [normalizePreset(makePreset())];
    expect(() => addPresetWithCap(list, makePreset({ name: "" })))
      .toThrow(/name/);
    expect(list).toHaveLength(1);
  });
});

describe("removePreset", () => {
  test("filters out the preset by id", () => {
    const p1 = normalizePreset(makePreset({ name: "a", id: "id-1" }));
    const p2 = normalizePreset(makePreset({ name: "b", id: "id-2" }));
    expect(removePreset([p1, p2], "id-1")).toEqual([p2]);
  });

  test("no-ops when the id is missing", () => {
    const p1 = normalizePreset(makePreset({ id: "id-1" }));
    expect(removePreset([p1], "id-missing")).toEqual([p1]);
  });
});

describe("findPreset", () => {
  test("returns the matching entry or null", () => {
    const p = normalizePreset(makePreset({ id: "abc" }));
    expect(findPreset([p], "abc")).toBe(p);
    expect(findPreset([p], "xyz")).toBeNull();
  });
});

describe("loadPresets + savePresets (fake storage)", () => {
  function makeFakeStorage(initial = {}) {
    const state = { ...initial };
    return {
      get: async (keys) => {
        const out = {};
        for (const k of keys) if (k in state) out[k] = state[k];
        return out;
      },
      set: async (kv) => Object.assign(state, kv),
      _state: state,
    };
  }

  test("loadPresets defaults to [] when nothing is stored", async () => {
    const storage = makeFakeStorage();
    expect(await loadPresets(storage)).toEqual([]);
  });

  test("savePresets writes the array under the storage key", async () => {
    const storage = makeFakeStorage();
    const presets = [normalizePreset(makePreset())];
    await savePresets(storage, presets);
    expect(storage._state.marketPresets).toEqual(presets);
  });
});
