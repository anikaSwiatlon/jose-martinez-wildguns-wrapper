# Privacy notice

This is a Manifest V3 browser extension. It runs entirely on your
machine and only sends data over the network when you explicitly ask
it to. This page lists exactly what data it touches and where each
piece can go.

## TL;DR

- **No third-party analytics, telemetry, or tracking.**
- The extension reads the WildGuns / Wildungs page you have open.
- The only outbound network calls are:
  - Game API calls (sending market offers, sending resource
    transports) using your existing logged-in session.
  - Your own Supabase project, if you've configured one in Settings.
  - DataStax Astra DB (a single shared collection, write-only) when
    you click **Save report**.

## What the extension reads from the page

Only when you actively use a feature on the relevant tab:

| Feature | Reads |
|---------|-------|
| Units tab → "Read units" | The support-units table on the open Wildungs page (unit names + counts per village). |
| Reports tab → "Save report" | The `#fightreport` element of the open battle report page (HTML + parsed fields). |
| Market tab → "Send Market Offers" | The page's `userToken` global, to authenticate the outgoing offer requests. |
| Market tab → "Send transports" | The page's `userToken` global plus the coordinates / amounts you typed into the table. |

The extension does **not** read your inbox, your alliance chat, your
profile, or any page outside the game itself. It registers content
scripts only for `*.wildungs.com` and `*.wildguns.gameforge.com`
(`manifest.json` → `content_scripts`).

## What gets stored locally

Held in `chrome.storage.local`, on your own machine, scoped to this
extension:

- Supabase project URL and anon key (entered in Settings).
- Visible-tab toggle preferences.
- Market offer presets (one row per saved offer).
- Resource-transfer presets (up to 10 named transports).
- Last-opened tab.

These never leave your machine unless you uninstall the extension or
explicitly clear browser storage.

## What leaves your machine, and where

Only when you click a button:

### Your own Supabase project (configured in Settings)

When you click **Send to Supabase** (Units tab) or **Save report**
(Reports tab), the extension POSTs JSON to the Supabase URL you
configured, using your own anon key. You control the project, the
table schema, and Row Level Security. The extension never sees a
different user's data.

### DataStax Astra DB (shared collection, write-only)

When you click **Save report**, the extension also writes the full
sanitized report DOM + parsed fields into a shared Astra collection
hosted by the project maintainer. The token embedded in the release
zip is scoped to **write-only access on one collection** — it
cannot read existing data, cannot enumerate other users' reports, and
cannot administer the database. See
[`docs/astra-setup.md`](https://github.com/anikaSwiatlon/jose-martinez-wildguns-wrapper/blob/main/docs/astra-setup.md)
for the role policy.

The data stored in Astra is the sanitized report DOM and structured
fields. It does **not** include your Supabase credentials, your
session cookies, or anything you typed into Settings. It does include
your in-game player name and village IDs (those are part of the
report itself).

### Game endpoints

The Market features make requests to the game's own
`ajax_interface.php` endpoint, authenticated by your existing session
cookies and the page's `userToken`. These are the same requests your
browser would make if you clicked the equivalent buttons in the game
UI; the extension just builds them programmatically.

## What the extension **never** does

- Send your session cookies or `userToken` anywhere except the game's
  own server (where they originated).
- Read or transmit data from other open tabs.
- Auto-update without your explicit install of a new release zip.
- Phone home with usage statistics.

## How to revoke / clear data

- **Local data**: `chrome://extensions` → this extension → Details →
  Extension options / Storage → Clear; or uninstall the extension.
- **Supabase data**: connect to your own project and delete the rows
  or drop the tables.
- **Astra data**: open a [GitHub issue](https://github.com/anikaSwiatlon/jose-martinez-wildguns-wrapper/issues/new)
  with the `report_id` (visible in the URL of the report you saved)
  and the maintainer will remove it.

## Changes to this notice

Material changes to data handling will be called out in
[`CHANGELOG.md`](https://github.com/anikaSwiatlon/jose-martinez-wildguns-wrapper/blob/main/CHANGELOG.md)
and shown on the [Patchnotes](patchnotes.html) page of this site.

_Last updated: 2026-05-21._
