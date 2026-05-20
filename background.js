// background.js
//
// Service worker. Handles:
//   SEND_TO_SUPABASE — generic Supabase insert (used by Units tab).
//   SEND_REPORT      — battle-report dual-write orchestrator:
//                      Supabase row holds metadata + astra_doc_id pointer,
//                      Astra holds the full dom_html + extracted JSON.

importScripts("lib/astra-client.js");
const { astraGet, astraUpsert } = self.astraClient;

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
// Pre-checks both stores for the report_id:
//   - if both have it → no-op ("Already saved")
//   - if only one has it → write to the missing side only
//   - if neither has it → write to Astra first, then Supabase with astra_doc_id
//
// Returns { success: true, astra, supabase } where each side is 'ok' | 'skipped' | error msg.

async function handleSendReport(captured) {
  if (!captured?.report_id) {
    return { success: false, error: "Captured report has no report_id." };
  }
  const reportId = String(captured.report_id);

  let supabaseHas = false;
  let astraHas = false;
  try { supabaseHas = await supabaseReportExists(reportId); }
  catch (e) { return { success: false, error: e.message }; }
  try { astraHas = (await astraGet(reportId)) !== null; }
  catch (e) {
    if (e.code !== "ASTRA_NOT_CONFIGURED") return { success: false, error: e.message };
    return { success: false, error: e.message };
  }

  if (supabaseHas && astraHas) {
    return { success: true, astra: "skipped", supabase: "skipped", duplicate: true };
  }

  const astraDoc = {
    report_id:  reportId,
    dom_html:   captured.dom_html,
    extracted:  captured.extracted,
    meta:       captured.meta,
  };
  let astraStatus = "skipped";
  if (!astraHas) {
    try {
      await astraUpsert(reportId, astraDoc);
      astraStatus = "ok";
    } catch (e) {
      return { success: false, astra: e.message, supabase: supabaseHas ? "skipped" : "not_attempted" };
    }
  }

  let supabaseStatus = "skipped";
  if (!supabaseHas) {
    const row = buildSupabaseRow(captured, reportId);
    try {
      await supabaseUpsertReportRow(row);
      supabaseStatus = "ok";
    } catch (e) {
      return { success: false, astra: astraStatus, supabase: e.message };
    }
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
