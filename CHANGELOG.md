# Changelog

All notable changes to this project will be documented in this file. The
format is loosely based on [Keep a Changelog](https://keepachangelog.com/),
and the project follows [SemVer](https://semver.org/).

## [Unreleased]

The v0.3.0 cycle reshapes the extension around safer credentials and a
cleaner separation between game-side work and stored data. See the
[dev-0-3 PRs](https://github.com/anikaSwiatlon/jose-martinez-wildguns-wrapper/pulls?q=base%3Adev-0-3) for the rolling list.

### Added

- Coordinate-based resource transfers in the Market tab, with saved
  presets (up to 10, LRU eviction).
- One-click "Save report" flow with metadata in Supabase and the full
  sanitized report DOM in DataStax Astra DB.
- Public GitHub Pages site (this one) covering download, patchnotes,
  license, privacy, and contact.
- `userToken` / cookie security warning in Settings and `instrukcja.md`.

### Changed

- CI now splits into three workflows: `validate.yml` for every PR,
  `dev-build.yml` for internal QA artifacts, and `release.yml` triggered
  only by `v*` tags.
- Battle-report parsing rewritten against the real game DOM —
  loot and spy results now extract correctly.

### Removed

- Pro tab and the paywalled `send-back-support` feature. Moved to a
  separate companion tool.

## [0.2.1] - 2026-05-12

### Added

- Feature toggles for individual tabs in Settings.
- Spy report parsing in battle reports (raw materials, units, groups,
  buildings).
- Jest test infrastructure with initial coverage of the battle-report
  parser.

## [0.2.0] - 2026-04-08

### Added

- Market offers tab.
- Battle reports tab (initial implementation).
- Pro tab (send-back-support — later removed in v0.3).

### Changed

- Popup chrome refreshed.

## [0.1.2] - 2026-02-15

### Added

- Richer unit data scraping from the support panel.
- GitHub Release pipeline that auto-publishes a zip on every push to
  `main`.

## [0.1.0] - 2026-01-20

Initial public release: scrape supporting unit summaries and push them
to Supabase.
