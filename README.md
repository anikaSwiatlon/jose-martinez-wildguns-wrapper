# Jose Martinez WildGuns Helper

Hola, como estas?

<img src="assets/jose-martinez-portrait.png" alt="jose's portrait" width="300"/>

My name is Jose Martinez and I am a humble mexican farmer. However don't
let that fool you. I am the type of person who knows a guy who knows a
guy who knows a guy who can help you manage your armed forces. Shall we
draft an arrangement for you to engage my services?

> 📖 **Visitors looking for the friendly tour:** the marketing page is
> at [the project site](https://anikaSwiatlon.github.io/jose-martinez-wildguns-wrapper/).
> Patchnotes, license, privacy, and contact info live there.

## What I can do for you

I am a small, polite, MV3 browser extension. I keep to myself, I don't
talk to strangers, and I only do what you ask. When you ride into the
WildGuns saloon, I can help you with:

- 📜 **Filing the reports.** Open a battle report, click my
  <kbd>Save report</kbd> button, and I'll quietly tuck both the
  parsed details and the full report into your archives — Supabase for
  the metadata you can query later, Astra DB for the heavy stuff.
- 📦 **Sending the supplies.** Type a pair of coordinates and four
  numbers, hit send, and crates of wood / clay / iron / food go where
  you told me. Save your daily transports as named presets so next
  time it's a single click. Up to ten presets, and I'll quietly retire
  the oldest one when I run out of pegs.
- 🤝 **Helping the tribe.** Paste a TSV/CSV right out of a
  spreadsheet — one row per ally village — and I'll fan out up to
  four requests at a time with a status mark on every row so you
  know what landed and what didn't.
- 🛒 **The market.** Drop a batch of trade offers into the table,
  pick a runtime, and I'll wire them all to the bazaar in one go.
- 🛡️ **Minding my own business.** No telemetry, no tracking, no
  third-party analytics. Read the
  [privacy notice](https://anikaSwiatlon.github.io/jose-martinez-wildguns-wrapper/legal.html#privacy)
  if you want the full inventory of what I read and what I send
  where.

## How to put me to work

1. Grab the latest zip from
   **[Releases](https://github.com/anikaSwiatlon/jose-martinez-wildguns-wrapper/releases/latest)**
   and unpack it somewhere quiet.
2. Open `chrome://extensions` (or your browser's equivalent — see
   compatibility below), flip on **Developer mode** in the top-right,
   then click **Load unpacked** and point at the folder.
3. Pin my icon to the toolbar so I'm easy to find.
4. Open the popup → **Settings** tab → paste your Supabase project URL
   and anon key. Save.
5. That's it. Open a battle report, click <kbd>Save report</kbd>, and
   we're in business.

A full Polish-language walkthrough lives at
[`docs/instrukcja.md`](docs/instrukcja.md).

## Compatibility

I am tested and known to work in Chrome, Edge, Brave, and Opera (any
recent Chromium will do). Firefox can load me as a temporary add-on
via `about:debugging` → **This Firefox** → **Load Temporary Add-on**
→ pick `manifest.json`.

<img src="assets/chrome-version.png" alt="chrome version" width="300"/>

## A short word about safety

I read your `userToken` straight from the game page so you never need
to type it anywhere. **Never paste curl commands, session cookies, or
`userToken` values from your browser into chats, screenshots, or any
helpers from forums.** Those values are the keys to your account.
If one of them slips out, log out of WildGuns and back in — the old
token becomes worthless.

There is a banner in the Settings tab and a longer note at the top of
[`docs/instrukcja.md`](docs/instrukcja.md) with more on this.

## For the helpers in the back

If you're a contributor rather than a player, here's where to look:

| You want to… | Go to |
|---|---|
| Run the test suite | `npm ci && npm test` |
| Build the zip locally | The GitHub Actions composite at [`.github/actions/build-extension`](.github/actions/build-extension/action.yml) does it; mirror its steps for local builds. |
| Cut a release | Bump `manifest.json` + `CHANGELOG.md` → merge to `main` → `git tag v{x.y.z} && git push --tags`. See [`docs/release-process.md`](docs/release-process.md). |
| Wire up Astra DB | See [`docs/astra-setup.md`](docs/astra-setup.md) — write-only role, GitHub Secrets, CI-injected config. |
| Build the GitHub Pages site | `node scripts/build-pages.mjs` then open `_site/index.html`. |
| Report a bug | [Open an issue](https://github.com/anikaSwiatlon/jose-martinez-wildguns-wrapper/issues/new); include extension version, browser, what you did, what you expected. |

## License

MIT. See [`LICENSE`](LICENSE).

Built with sweat and tequila by Anika Światłoń. Adios.
