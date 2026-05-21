// background.js
//
// Service worker. Handles:
//   SEND_TO_SUPABASE — generic Supabase insert (used by Units tab).
//   SEND_REPORT      — battle-report dual-write orchestrator:
//                      Supabase row holds metadata + astra_doc_id pointer,
//                      Astra holds the full dom_html + extracted JSON.
//
// The Astra credentials are baked in at release build time (write-only role
// scoped to one collection). lib/astra-config.js is gitignored and may be
// absent on dev/PR builds — the importScripts call is wrapped so the worker
// boots either way; the Save Report button surfaces ASTRA_NOT_CONFIGURED with
// an actionable message when the config is missing.

try { importScripts("lib/astra-config.js"); } catch (_) { /* config absent */ }
importScripts("lib/astra-client.js");
const { astraUpsert } = self.astraClient;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "SEND_TO_SUPABASE") {
    handleSupabasePost(message.table, message.payload)
      .then(r  => sendResponse(r))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (message.type === "SEND_REPORT") {
    handleSendReport(message.captured)
      .then(r  => sendResponse(r))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

// ── Supabase helpers ───────────────────────────────────────────────────────────────────────

async function getSupabaseConfig() {
  const cfg = await chrome.storage.local.get([
    "supabaseUrl", "supabaseAnonKey", "supabaseUserToken",
  ]);
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    const err = new Error("Supabase not configured. Open Settings.");
    err.code = "SUPABASE_NOT_CONFIGURED";
    throw err;
  }
  return cfg;
}

function supabaseHeaders(cfg) {
  const authHeader = cfg.supabaseUserToken
    ? `Bearer ${cfg.supabaseUserToken}`
    : `Bearer ${cfg.supabaseAnonKey}`;
  return {
    "Content-Type":  "application/json",
    "apikey":        cfg.supabaseAnonKey,
    "Authorization": authHeader,
  };
}

async function handleSupabasePost(table, payload) {
  const cfg = await getSupabaseConfig();
  const res = await fetch(`${cfg.supabaseUrl}/rest/v1/${table}`, {
    method:  "POST",
    headers: { ...supabaseHeaders(cfg), "Prefer": "return=minimal" },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) {
    return { success: false, error: `Supabase ${res.status}: ${await res.text()}` };
  }
  return { success: true };
}

async function supabaseReportExists(reportId) {
  const cfg = await getSupabaseConfig();
  const url = `${cfg.supabaseUrl}/rest/v1/battle_reports?report_id=eq.${reportId}&select=report_id&limit=1`;
  const res = await fetch(url, { method: "GET", headers: supabaseHeaders(cfg) });
  if (!res.ok) throw new Error(`Supabase GET ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function supabaseUpsertReportRow(row) {
  const cfg = await getSupabaseConfig();
  const url = `${cfg.supabaseUrl}/rest/v1/battle_reports?on_conflict=report_id`;
  const res = await fetch(url, {
    method:  "POST",
    headers: {
      ...supabaseHeaders(cfg),
      "Prefer": "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    throw new Error(`Supabase upsert ${res.status}: ${await res.text()}`);
  }
}

// ── SEND_REPORT orchestrator ───────────────────────────────────────────────────────────────
//
// The Astra token is write-only, so we can't GET-check whether a doc already
// exists on the Astra side. Dedup is therefore Supabase-only: if Supabase
// already has the report_id, we skip both writes ("Already saved"). Astra's
// PUT is idempotent on the same docId, so re-running a save for a partially-
// failed previous attempt simply overwrites the doc — which is the behaviour
// we want.
//
// Returns { success, astra, supabase, duplicate? } where astra/supabase is
// 'ok' | 'skipped' | error message.

async function handleSendReport(captured) {
  if (!captured?.report_id) {
    return { success: false, error: "Captured report has no report_id." };
  }
  const reportId = String(captured.report_id);

  let supabaseHas = false;
  try { supabaseHas = await supabaseReportExists(reportId); }
  catch (e) { return { success: false, error: e.message }; }

  if (supabaseHas) {
    return { success: true, astra: "skipped", supabase: "skipped", duplicate: true };
  }

  const astraDoc = {
    report_id:  reportId,
    dom_html:   captured.dom_html,
    extracted:  captured.extracted,
    meta:       captured.meta,
  };
  let astraStatus;
  try {
    await astraUpsert(reportId, astraDoc);
    astraStatus = "ok";
  } catch (e) {
    return { success: false, astra: e.message, supabase: "not_attempted" };
  }

  let supabaseStatus;
  const row = buildSupabaseRow(captured, reportId);
  try {
    await supabaseUpsertReportRow(row);
    supabaseStatus = "ok";
  } catch (e) {
    return { success: false, astra: astraStatus, supabase: e.message };
  }

  return { success: true, astra: astraStatus, supabase: supabaseStatus };
}

function buildSupabaseRow(captured, reportId) {
  const ex = captured.extracted ?? {};
  return {
    report_id:            reportId,
    attacker_player_id:   ex.attacker?.player_id   ?? null,
    attacker_village_id:  ex.attacker?.village_id  ?? null,
    defender_player_id:   ex.defender?.player_id   ?? null,
    defender_village_id:  ex.defender?.village_id  ?? null,
    title:                ex.title ?? null,
    report_date:          ex.date  ?? null,
    page_url:             captured.meta?.page_url   ?? null,
    scraped_at:           captured.meta?.scraped_at ?? null,
    astra_doc_id:         reportId,
  };
}
