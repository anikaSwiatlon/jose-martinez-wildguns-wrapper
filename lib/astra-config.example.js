// lib/astra-config.example.js
//
// Template showing the expected shape of lib/astra-config.js, which is the
// file the background service worker actually loads at runtime.
//
// lib/astra-config.js is gitignored. It is produced by either of two paths:
//
//   1. CI (release.yml): the build-extension composite action writes it from
//      the ASTRA_WRITE_TOKEN secret + ASTRA_DB_ID / ASTRA_REGION /
//      ASTRA_KEYSPACE / ASTRA_COLLECTION repo variables. PR and dev-build
//      workflows do NOT pass the secret, so they produce a stub config
//      (ASTRA_CONFIG = null) and the Save Report button fails gracefully.
//
//   2. Local development: a contributor who wants Save Report to work locally
//      copies this file to lib/astra-config.js and fills in their own dev
//      Astra credentials. The file stays out of git.
//
// The token used here MUST be scoped to write-only access on a single
// collection. See docs/astra-setup.md for how to create a custom Astra role
// with that scope. The token is shipped inside the public release zip —
// anyone who downloads the extension can read it. Limiting the role to
// "write one collection" is what bounds the blast radius.

self.ASTRA_CONFIG = {
  dbId:       "00000000-0000-0000-0000-000000000000",
  region:     "us-east1",
  keyspace:   "wildguns",
  collection: "battle_reports",
  token:      "AstraCS:PLACEHOLDER:write-only-token",
};
