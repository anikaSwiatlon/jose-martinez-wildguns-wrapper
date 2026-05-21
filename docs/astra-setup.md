# Astra DB setup (maintainer)

This is a **maintainer guide**, not user-facing documentation. End users
never see Astra credentials — they're baked into the release zip at
build time. This page covers how to provision the database, create a
write-only token, and wire it into the release workflow.

## Why write-only

The extension is distributed as a public release zip. Anything inside
the zip — including any embedded API token — is readable by anyone who
unzips the download. We therefore embed only a token whose role is
**scoped to writes against the single `battle_reports` collection**.
The worst case if the token leaks is spam writes to that one
collection. The token cannot read existing data, cannot touch other
collections, cannot administer the database.

Dedup is handled on the Supabase side (each user's own per-user
Supabase). Astra's `PUT` is idempotent on the document id, so duplicate
writes are silently overwritten.

## 1. Provision the database

1. Sign in at <https://astra.datastax.com>.
2. **Create Database** → **Serverless (Non-Vector)**.
3. Name it (e.g. `wildguns-prod`), set keyspace `wildguns`, pick any
   cloud + region.
4. Wait for provisioning (~2 minutes).
5. From the database overview, note:
   - **Database ID** (UUID).
   - **Region** (e.g. `us-east1`).

## 2. Create the collection

1. Open **Data Explorer** for the database.
2. Select keyspace `wildguns`.
3. Add collection `battle_reports`.

(Names don't have to match these — but the GitHub repo variables in
step 5 must match what you actually used.)

## 3. Create a custom write-only role

The Astra "Database Administrator" role grants far more access than we
want. Create a custom role that only permits document writes against
the single collection.

1. Astra UI → **Settings** → **Roles** → **Add Custom Role**.
2. Name: `wildguns-write-only`.
3. Permissions:
   - **Data API** — grant `data_modify_drop`, `data_modify_write` on
     resource `data:<keyspace>/<collection>` (e.g.
     `data:wildguns/battle_reports`).
   - Nothing else. No read permissions. No keyspace admin. No DB admin.
4. Save the role.

## 4. Generate the application token

1. Astra UI → **Connect** → **Tokens** → **Generate Token**.
2. Choose the role you just created (`wildguns-write-only`).
3. Copy the `AstraCS:…` token. You will not be able to view it again.

## 5. Add the token + IDs to the repo

The release workflow reads five inputs through the build-extension
composite action. They map to GitHub repo settings as follows:

| Astra value     | GitHub setting                          | Type      |
|-----------------|------------------------------------------|-----------|
| Application token | `ASTRA_WRITE_TOKEN`                    | **Secret** |
| Database ID       | `ASTRA_DB_ID`                          | Variable  |
| Region            | `ASTRA_REGION`                         | Variable  |
| Keyspace          | `ASTRA_KEYSPACE`                       | Variable  |
| Collection        | `ASTRA_COLLECTION`                     | Variable  |

To configure:

1. Repo → **Settings** → **Secrets and variables** → **Actions**.
2. **Secrets** tab → `New repository secret` → name `ASTRA_WRITE_TOKEN`,
   paste the `AstraCS:…` value.
3. **Variables** tab → add the four non-secret values
   (`ASTRA_DB_ID`, `ASTRA_REGION`, `ASTRA_KEYSPACE`, `ASTRA_COLLECTION`).

All three workflows that call the build-extension action
(`release.yml`, `dev-build.yml`, `validate.yml`) pass the same secret +
variables. Reasoning: the token is already write-only and limited to one
collection, the same blast radius applies whether it sits in a release
zip or a dev-build artifact, and dev artifacts that match the production
config let maintainers verify the Save Report flow end-to-end before
publishing a release.

The only case where the build falls back to the stub config
(`ASTRA_CONFIG = null`) is when the secret is not available to the
workflow run at all — for example a PR opened from a public fork, where
GitHub strips `secrets.*` for security. In that case the build still
completes; Save Report just surfaces `ASTRA_NOT_CONFIGURED` at runtime.

## 6. Rotate the token

If the public zip is ever flooded with abusive writes:

1. Astra UI → **Settings** → **Tokens** → revoke the leaked token.
2. Generate a new one with the same `wildguns-write-only` role.
3. Update the `ASTRA_WRITE_TOKEN` GitHub secret.
4. Cut a new release — every subsequent download embeds the new token.

Old installations keep working with the old (now-revoked) token until
the user updates. That's acceptable: the next Save Report click on an
old install will fail with `Astra PUT 401`; the user updates and
recovers.

## Local development (no CI)

A contributor who wants Save Report to work locally has two options:

1. **Skip Astra entirely.** Without `lib/astra-config.js`, the
   background worker boots fine, Supabase writes work as normal, and
   Save Report returns `Astra: ASTRA_NOT_CONFIGURED` while still
   completing the Supabase side. This is the easiest setup for
   contributors not touching the Astra integration.
2. **Provide local credentials.** Copy `lib/astra-config.example.js`
   to `lib/astra-config.js` and fill in your own dev Astra DB. The
   file is gitignored so it can't be committed accidentally. Use a
   throwaway dev DB — never paste production credentials here.
