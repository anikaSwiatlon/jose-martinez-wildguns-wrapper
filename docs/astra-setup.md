# Astra DB setup

The extension stores the full battle-report DOM and parsed JSON in
**DataStax Astra DB** (now an IBM-owned product). Supabase keeps only
the metadata + a pointer; Astra holds everything else.

This guide walks through provisioning the database and feeding the
credentials into the extension Settings tab.

## 1. Create an Astra account

1. Go to <https://astra.datastax.com> and sign in (free tier is fine for
   this use case — see the **Free tier limits** section below).
2. Once signed in, you land on the **Databases** dashboard.

## 2. Create a Serverless database

1. Click **Create Database**.
2. Choose **Serverless (Non-Vector)** — we don't need vector search.
3. Pick a name (e.g. `wildguns-prod`), a **keyspace name** (use
   `wildguns` to match the default), and a cloud provider + region.
4. Click **Create Database**. Provisioning takes ~2 minutes.

When it's ready, note two values from the database details page:

- **Database ID** — the UUID shown under the name (e.g.
  `00000000-0000-0000-0000-000000000000`).
- **Region** — e.g. `us-east1`.

## 3. Create the collection

The Document API stores JSON in **collections** inside a keyspace.

1. From the database overview, open **Data Explorer** (or use the
   **Connect → Document API** quick-start tab).
2. Select keyspace `wildguns`.
3. Create a collection named `battle_reports`.

If you used different names, write them down — you'll paste them into
the Settings tab.

## 4. Generate an Application Token

1. From the database page, open **Connect → Token**.
2. Choose role **Database Administrator** (lets the extension read +
   write to the collection).
3. Click **Generate Token**.
4. Copy the **Application Token** (starts with `AstraCS:…`). You will
   not be able to view it again, so store it somewhere safe before
   leaving the page.

## 5. Paste credentials into the extension

Open the extension popup → **Settings** tab. Fill in the new Astra
section:

| Field | Value |
|-------|-------|
| Database ID | the UUID from step 2 |
| Region | e.g. `us-east1` |
| Keyspace | `wildguns` (or whatever you named it) |
| Collection | `battle_reports` |
| Application Token | the `AstraCS:…` token from step 4 |

Click **Save settings**. The Reports tab's **Save report** button will
now dual-write each report: metadata into Supabase, full JSON into
Astra.

## Free tier limits

The Astra free tier gives you 80 GB of storage and 20M monthly read +
20M monthly write operations. Each saved battle report is roughly
25-30 KB (full sanitized DOM + structured JSON), so the free tier
comfortably handles tens of thousands of reports per month.

## Troubleshooting

- **"Astra not configured: missing …"** — one of the five fields in
  Settings is empty. Re-paste from your notes.
- **`Astra GET 401`** — the Application Token doesn't have access to
  the keyspace. Regenerate with `Database Administrator` role.
- **`Astra PUT 404`** — the keyspace or collection name is wrong. Check
  the spelling against the Data Explorer.
- **`Astra GET 502/503`** — Astra cold-start. The DB hibernates after
  inactivity; first request after a long pause wakes it. Retry once.
