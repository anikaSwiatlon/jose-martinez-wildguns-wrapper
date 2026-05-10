// background.js

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "SEND_TO_SUPABASE") return;

  handlePost(message.table, message.payload)
    .then(r  => sendResponse(r))
    .catch(e => sendResponse({ success: false, error: e.message }));

  return true;
});

async function handlePost(table, payload) {
  const { supabaseUrl, supabaseAnonKey, supabaseUserToken } =
    await chrome.storage.local.get(["supabaseUrl", "supabaseAnonKey", "supabaseUserToken"]);

  if (!supabaseUrl || !supabaseAnonKey) {
    return { success: false, error: "Supabase not configured. Open Settings." };
  }

  const authHeader = supabaseUserToken
    ? `Bearer ${supabaseUserToken}`
    : `Bearer ${supabaseAnonKey}`;

  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "apikey":        supabaseAnonKey,
      "Authorization": authHeader,
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `Supabase ${res.status}: ${text}` };
  }
  return { success: true };
}
