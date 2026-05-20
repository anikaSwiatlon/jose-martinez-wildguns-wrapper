// features/resource-transfer/content.js
//
// Wraps the game's market transport endpoint. Injected into the active tab
// when the user clicks "Send transports" so the request inherits the player's
// session cookies and userToken from the page.
//
// Endpoint (confirmed from a user-supplied curl example):
//
//   GET https://{world-host}/ajax_interface.php
//     ?ajax_action=requestMarketTransport
//     &amountWood=… &amountBrick=… &amountOre=… &amountFood=…
//     &targetX=… &targetY=…
//     &userToken=…
//
// The endpoint accepts raw target coords directly — no village_id lookup
// required. Cookies are sent automatically via credentials:"include".

// ── Pure helpers (also exported for Jest) ─────────────────────────────────────────────────

function parseCoords(raw) {
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d+)\s*\|\s*(\d+)$/);
  if (!m) return null;
  return { targetX: parseInt(m[1], 10), targetY: parseInt(m[2], 10) };
}

function validateTransport(t) {
  if (!t || typeof t !== "object") return "transport must be an object";
  if (!Number.isInteger(t.targetX) || t.targetX < 0) return "targetX must be a non-negative integer";
  if (!Number.isInteger(t.targetY) || t.targetY < 0) return "targetY must be a non-negative integer";
  const amounts = ["amountWood", "amountBrick", "amountOre", "amountFood"];
  for (const k of amounts) {
    const v = t[k];
    if (!Number.isInteger(v) || v < 0) return `${k} must be a non-negative integer`;
  }
  const total = amounts.reduce((s, k) => s + t[k], 0);
  if (total <= 0) return "at least one resource amount must be greater than zero";
  return null;
}

function buildTransportUrl(origin, transport, userToken) {
  const params = new URLSearchParams({
    ajax_action: "requestMarketTransport",
    amountWood:  String(transport.amountWood),
    amountBrick: String(transport.amountBrick),
    amountOre:   String(transport.amountOre),
    amountFood:  String(transport.amountFood),
    targetX:     String(transport.targetX),
    targetY:     String(transport.targetY),
    userToken:   String(userToken),
  });
  return `${origin}/ajax_interface.php?${params.toString()}`;
}

// Bounded concurrency: run `worker(item, index)` over `items` with at most
// `cap` in flight at a time. Resolves with the array of settled results,
// preserving input order.
async function mapWithConcurrency(items, cap, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runOne() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { status: "fulfilled", value: await worker(items[i], i) };
      } catch (e) {
        results[i] = { status: "rejected", reason: e };
      }
    }
  }
  const workers = Array.from({ length: Math.min(cap, items.length) }, runOne);
  await Promise.all(workers);
  return results;
}

// ── In-page driver (invoked via chrome.scripting.executeScript) ──────────────────────────
//
// Defined as a top-level function so popup.js can pass it as `func:` to
// executeScript. The popup serialises `transports` as the args payload.

function sendTransportsOnPage(transports) {
  // userToken is exposed as a global on every authenticated game page.
  if (typeof userToken === "undefined" || !userToken) {
    return { ok: false, error: "userToken not found on page. Are you logged into the game?" };
  }
  const origin = window.location.origin;

  function buildUrl(t) {
    var p = new URLSearchParams({
      ajax_action: "requestMarketTransport",
      amountWood:  String(t.amountWood),
      amountBrick: String(t.amountBrick),
      amountOre:   String(t.amountOre),
      amountFood:  String(t.amountFood),
      targetX:     String(t.targetX),
      targetY:     String(t.targetY),
      userToken:   String(userToken),
    });
    return origin + "/ajax_interface.php?" + p.toString();
  }

  function sendOne(t) {
    return fetch(buildUrl(t), {
      method: "GET",
      credentials: "include",
      headers: {
        "x-requested-with":   "XMLHttpRequest",
        "x-prototype-version": "1.7.3",
      },
    }).then(function(res) {
      if (!res.ok) return { ok: false, status: res.status, error: "HTTP " + res.status };
      return res.text().then(function(body) {
        // The game returns JSON-ish text; surface anything that looks like
        // an error string. Empty / success responses are sometimes "true".
        var lower = body.toLowerCase();
        if (lower.includes("error") && !lower.includes("\"error\":null")) {
          return { ok: false, status: res.status, error: body.slice(0, 200) };
        }
        return { ok: true, status: res.status };
      });
    });
  }

  // Bounded concurrency via a 4-slot worker pool. Returns settled results
  // in the original input order so the popup can colour each row.
  var cap = 4;
  var next = 0;
  var results = new Array(transports.length);

  function runOne() {
    var i = next++;
    if (i >= transports.length) return Promise.resolve();
    return sendOne(transports[i])
      .then(function(r) { results[i] = r; })
      .catch(function(e) { results[i] = { ok: false, error: String(e && e.message || e) }; })
      .then(runOne);
  }

  var workers = [];
  for (var w = 0; w < Math.min(cap, transports.length); w++) workers.push(runOne());

  return Promise.all(workers).then(function() {
    return { ok: true, results: results };
  });
}

// ── Exports ───────────────────────────────────────────────────────────────────────────────

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    parseCoords, validateTransport, buildTransportUrl,
    mapWithConcurrency, sendTransportsOnPage,
  };
}
