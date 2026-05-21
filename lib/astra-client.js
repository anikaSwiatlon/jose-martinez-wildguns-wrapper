// lib/astra-client.js
//
// Minimal wrapper around the DataStax Astra DB Document API.
//
// The credentials live in lib/astra-config.js, which is gitignored and produced
// at build time by the CI workflow from GitHub Secrets (see
// docs/astra-setup.md). This file expects `self.ASTRA_CONFIG` to either be the
// generated object or `null` when no credentials were available at build time.
//
// The shipped token has WRITE-ONLY scope on a single collection. Therefore we
// only expose `astraUpsert` here — read/GET would 401 with the production
// token, so dedup is handled by the Supabase side (see background.js).
//
// Endpoint shape:
//   PUT https://{dbId}-{region}.apps.astra.datastax.com
//     /api/rest/v2/namespaces/{keyspace}/collections/{collection}/{docId}

function getAstraConfig() {
  const cfg = self.ASTRA_CONFIG;
  if (!cfg) {
    const err = new Error("Astra is not configured in this build. Production releases include credentials; dev/PR builds do not. See docs/astra-setup.md.");
    err.code = "ASTRA_NOT_CONFIGURED";
    throw err;
  }
  const missing = [];
  for (const key of ["dbId", "region", "keyspace", "collection", "token"]) {
    if (!cfg[key] || String(cfg[key]).includes("PLACEHOLDER")) missing.push(key);
  }
  if (missing.length) {
    const err = new Error(`Astra config is incomplete: missing ${missing.join(", ")}.`);
    err.code = "ASTRA_NOT_CONFIGURED";
    throw err;
  }
  return cfg;
}

function buildDocUrl(cfg, docId) {
  const base = `https://${cfg.dbId}-${cfg.region}.apps.astra.datastax.com`;
  return `${base}/api/rest/v2/namespaces/${cfg.keyspace}/collections/${cfg.collection}/${encodeURIComponent(docId)}`;
}

async function astraUpsert(docId, document) {
  const cfg = getAstraConfig();
  const res = await fetch(buildDocUrl(cfg, docId), {
    method: "PUT",
    headers: {
      "Content-Type":      "application/json",
      "x-cassandra-token": cfg.token,
    },
    body: JSON.stringify(document),
  });
  if (!res.ok) {
    throw new Error(`Astra PUT ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

self.astraClient = { astraUpsert, getAstraConfig, buildDocUrl };

// CommonJS export so Jest can exercise pure helpers (buildDocUrl, getAstraConfig).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { astraUpsert, getAstraConfig, buildDocUrl };
}
