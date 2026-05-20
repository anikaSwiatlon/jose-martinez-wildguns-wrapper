const {
  parseCoords,
  validateTransport,
  buildTransportUrl,
  mapWithConcurrency,
} = require("../features/resource-transfer/content");

describe("parseCoords", () => {
  test("parses standard X|Y format", () => {
    expect(parseCoords("500|500")).toEqual({ targetX: 500, targetY: 500 });
  });

  test("tolerates surrounding whitespace and whitespace around the pipe", () => {
    expect(parseCoords("  321 | 654  ")).toEqual({ targetX: 321, targetY: 654 });
  });

  test("rejects malformed input", () => {
    expect(parseCoords("500-500")).toBeNull();
    expect(parseCoords("500")).toBeNull();
    expect(parseCoords("|500")).toBeNull();
    expect(parseCoords("")).toBeNull();
    expect(parseCoords("foo|bar")).toBeNull();
  });

  test("returns null for non-strings", () => {
    expect(parseCoords(null)).toBeNull();
    expect(parseCoords(undefined)).toBeNull();
    expect(parseCoords(123)).toBeNull();
  });
});

describe("validateTransport", () => {
  const valid = { targetX: 500, targetY: 500, amountWood: 100, amountBrick: 0, amountOre: 0, amountFood: 0 };

  test("returns null for a valid transport", () => {
    expect(validateTransport(valid)).toBeNull();
  });

  test("requires integer coords >= 0", () => {
    expect(validateTransport({ ...valid, targetX: -1   })).toMatch(/targetX/);
    expect(validateTransport({ ...valid, targetY: 1.5  })).toMatch(/targetY/);
    expect(validateTransport({ ...valid, targetX: "10" })).toMatch(/targetX/);
  });

  test("rejects all-zero resource amounts", () => {
    expect(validateTransport({ ...valid, amountWood: 0 })).toMatch(/at least one/);
  });

  test("rejects negative or non-integer amounts", () => {
    expect(validateTransport({ ...valid, amountBrick: -50 })).toMatch(/amountBrick/);
    expect(validateTransport({ ...valid, amountOre: 1.5  })).toMatch(/amountOre/);
  });
});

describe("buildTransportUrl", () => {
  const t = { targetX: 500, targetY: 500, amountWood: 1000, amountBrick: 200, amountOre: 0, amountFood: 50 };

  test("constructs the requestMarketTransport URL with all required params", () => {
    const url = buildTransportUrl("https://example.com", t, "tok-123");
    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://example.com");
    expect(parsed.pathname).toBe("/ajax_interface.php");
    const sp = parsed.searchParams;
    expect(sp.get("ajax_action")).toBe("requestMarketTransport");
    expect(sp.get("amountWood")).toBe("1000");
    expect(sp.get("amountBrick")).toBe("200");
    expect(sp.get("amountOre")).toBe("0");
    expect(sp.get("amountFood")).toBe("50");
    expect(sp.get("targetX")).toBe("500");
    expect(sp.get("targetY")).toBe("500");
    expect(sp.get("userToken")).toBe("tok-123");
  });

  test("URL-encodes special characters in userToken", () => {
    const url = buildTransportUrl("https://x.com", t, "abc def&xyz");
    expect(url).toContain("userToken=abc+def%26xyz");
  });
});

describe("mapWithConcurrency", () => {
  test("preserves input order in the result array", async () => {
    const items = [10, 20, 30, 40, 50];
    const results = await mapWithConcurrency(items, 2, async (n) => {
      await new Promise(r => setTimeout(r, n % 20)); // vary completion order
      return n * 2;
    });
    expect(results.map(r => r.status === "fulfilled" ? r.value : null)).toEqual([20, 40, 60, 80, 100]);
  });

  test("captures rejections without crashing the whole batch", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(results[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(results[1].status).toBe("rejected");
    expect(results[1].reason.message).toBe("boom");
    expect(results[2]).toEqual({ status: "fulfilled", value: 3 });
  });

  test("respects the concurrency cap (never more than `cap` in flight)", async () => {
    let inFlight = 0, peak = 0;
    await mapWithConcurrency([1,2,3,4,5,6,7,8], 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  test("empty input resolves to empty array immediately", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});
