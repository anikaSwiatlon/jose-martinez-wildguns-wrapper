// lib/astra-client.js
//
// Minimal wrapper around the DataStax Astra DB Document API.
// Used from background.js to upsert full battle-report JSON documents.
//
// Reads credentials from chrome.storage.local:
//   astraDbId        — UUID part of the Astra database
//   astraRegion      — e.g. "us-east1"
//   astraKeyspace    — e.g. "wildguns"
//   astraCollection  — e.g. "battle_reports"
//   astraToken       — Application Token (AstraCS:...)
//
// Endpoint shape:
//   https://{dbId}-{region}.apps.astra.datastax.com
//     /api/rest/v2/namespaces/{keyspace}/collections/{collection}/{docId}

async function getAstraConfig() {
  const cfg = await chrome.storage.local.get([
    "astraDbId", "astraRegion", "astraKeyspace", "astraCollection", "astraToken",
  ]);
  const missing = [];
  if (!cfg.astraDbId)       missing.push("Database ID");
  if (!cfg.astraRegion)     missing.push("Region");
  if (!cfg.astraKeyspace)   missing.push("Keyspace");
  if (!cfg.astraCollection) missing.push("Collection");
  if (!cfg.astraToken)      missing.push("Application Token");
  if (missing.length) {
    const err = new Error(`Astra not configured: missing ${missing.join(", ")}.`);
    err.code = "ASTRA_NOT_CONFIGURED";
    throw err;
  }
  return cfg;
}

function buildDocUrl(cfg, docId) {
  const base = `https://${cfg.astraDbId}-${cfg.astraRegion}.apps.astra.datastax.com`;
  return `${base}/api/rest/v2/namespaces/${cfg.astraKeyspace}/collections/${cfg.astraCollection}/${docId}`;
}

async function astraGet(docId) {
  const cfg = await getAstraConfig();
  const res = await fetch(buildDocUrl(cfg, docId), {
    method: "GET",
    headers: { "x-cassandra-token": cfg.astraToken },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Astra GET ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function astraUpsert(docId, document) {
  const cfg = await getAstraConfig();
  const res = await fetch(buildDocUrl(cfg, docId), {
    method: "PUT",
    headers: {
      "Content-Type":      "application/json",
      "x-cassandra-token": cfg.astraToken,
    },
    body: JSON.stringify(document),
  });
  if (!res.ok) {
    throw new Error(`Astra PUT ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

self.astraClient = { astraGet, astraUpsert, getAstraConfig };
