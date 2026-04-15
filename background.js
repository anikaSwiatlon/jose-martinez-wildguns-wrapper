// background.js
// Service worker. Receives the parsed unit data from the popup and
// POSTs it to Supabase.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "SEND_TO_SUPABASE") return;

  // Run async and keep the message channel open.
  handleSupabasePost(message.payload)
    .then((result) => sendResponse(result))
    .catch((err)  => sendResponse({ success: false, error: err.message }));

  return true; // keeps sendResponse alive for async
});

async function handleSupabasePost(payload) {
  // Pull config from storage (set by the settings/popup on first run).
  const { supabaseUrl, supabaseAnonKey, supabaseUserToken } =
    await chrome.storage.local.get(["supabaseUrl", "supabaseAnonKey", "supabaseUserToken"]);

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      success: false,
      error: "Supabase URL or anon key not configured. Open the extension settings.",
    };
  }

  const endpoint = `${supabaseUrl}/rest/v1/unit_snapshots`;

  // Use the user JWT if logged in, otherwise fall back to the anon key.
  const authHeader = supabaseUserToken
    ? `Bearer ${supabaseUserToken}`
    : `Bearer ${supabaseAnonKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        supabaseAnonKey,
      "Authorization": authHeader,
      "Prefer":        "return=minimal", // don't return the full row
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    return { success: false, error: `Supabase error ${response.status}: ${text}` };
  }

  return { success: true };
}
