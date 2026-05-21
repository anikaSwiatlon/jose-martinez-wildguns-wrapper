// Tests for lib/astra-client.js. The module reads from `self.ASTRA_CONFIG`,
// which in CommonJS-land we shim onto `global` before requiring it. Each test
// resets the cache to make sure the module re-reads the global on every load.

function loadClient() {
  jest.resetModules();
  return require("../lib/astra-client");
}

beforeEach(() => {
  global.self = global; // the module assigns to `self.astraClient` in browser; in Jest just point at global
  delete global.ASTRA_CONFIG;
});

afterEach(() => {
  delete global.ASTRA_CONFIG;
});

describe("getAstraConfig", () => {
  test("throws ASTRA_NOT_CONFIGURED when self.ASTRA_CONFIG is null", () => {
    global.ASTRA_CONFIG = null;
    const { getAstraConfig } = loadClient();
    expect(() => getAstraConfig()).toThrow(/not configured/);
    try { getAstraConfig(); } catch (e) { expect(e.code).toBe("ASTRA_NOT_CONFIGURED"); }
  });

  test("throws ASTRA_NOT_CONFIGURED when self.ASTRA_CONFIG is undefined", () => {
    const { getAstraConfig } = loadClient();
    expect(() => getAstraConfig()).toThrow(/not configured/);
  });

  test("throws ASTRA_NOT_CONFIGURED when any field contains PLACEHOLDER", () => {
    global.ASTRA_CONFIG = {
      dbId: "00000000-0000-0000-0000-000000000000",
      region: "us-east1",
      keyspace: "wildguns",
      collection: "battle_reports",
      token: "AstraCS:PLACEHOLDER:abc",
    };
    const { getAstraConfig } = loadClient();
    expect(() => getAstraConfig()).toThrow(/incomplete/);
  });

  test("throws when a required field is missing entirely", () => {
    global.ASTRA_CONFIG = {
      dbId: "abc-def",
      region: "us-east1",
      keyspace: "wildguns",
      collection: "battle_reports",
      // token missing
    };
    const { getAstraConfig } = loadClient();
    expect(() => getAstraConfig()).toThrow(/token/);
  });

  test("returns the config object when all fields are present and non-placeholder", () => {
    const cfg = {
      dbId: "abc-def-123",
      region: "us-east1",
      keyspace: "wildguns",
      collection: "battle_reports",
      token: "AstraCS:realtoken:value",
    };
    global.ASTRA_CONFIG = cfg;
    const { getAstraConfig } = loadClient();
    expect(getAstraConfig()).toEqual(cfg);
  });
});

describe("buildDocUrl", () => {
  const cfg = {
    dbId: "abc-def-123",
    region: "us-east1",
    keyspace: "wildguns",
    collection: "battle_reports",
    token: "AstraCS:realtoken:value",
  };

  test("constructs the Document API endpoint for a given docId", () => {
    const { buildDocUrl } = loadClient();
    const url = buildDocUrl(cfg, "1744365");
    expect(url).toBe(
      "https://abc-def-123-us-east1.apps.astra.datastax.com/api/rest/v2/namespaces/wildguns/collections/battle_reports/1744365"
    );
  });

  test("URL-encodes the docId so weird characters can't break the path", () => {
    const { buildDocUrl } = loadClient();
    const url = buildDocUrl(cfg, "weird/id with spaces");
    expect(url).toContain("/battle_reports/weird%2Fid%20with%20spaces");
  });
});

describe("astraUpsert (network)", () => {
  const cfg = {
    dbId: "abc",
    region: "us-east1",
    keyspace: "wildguns",
    collection: "battle_reports",
    token: "AstraCS:realtoken:value",
  };

  test("PUTs JSON with the x-cassandra-token header and resolves on 2xx", async () => {
    global.ASTRA_CONFIG = cfg;
    const calls = [];
    global.fetch = jest.fn(async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ documentId: "1744365" }),
      };
    });
    const { astraUpsert } = loadClient();
    const result = await astraUpsert("1744365", { hello: "world" });
    expect(result).toEqual({ documentId: "1744365" });
    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].init.headers["x-cassandra-token"]).toBe("AstraCS:realtoken:value");
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calls[0].init.body)).toEqual({ hello: "world" });
  });

  test("throws with the response body when the server returns non-2xx", async () => {
    global.ASTRA_CONFIG = cfg;
    global.fetch = jest.fn(async () => ({
      ok: false, status: 401,
      text: async () => "Unauthorized",
      json: async () => ({}),
    }));
    const { astraUpsert } = loadClient();
    await expect(astraUpsert("1", {})).rejects.toThrow(/Astra PUT 401: Unauthorized/);
  });

  test("does not attempt the network call when config is missing", async () => {
    global.ASTRA_CONFIG = null;
    let fetchCalled = false;
    global.fetch = jest.fn(async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; });
    const { astraUpsert } = loadClient();
    await expect(astraUpsert("1", {})).rejects.toThrow(/not configured/);
    expect(fetchCalled).toBe(false);
  });
});
