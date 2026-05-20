# Astra DB setup

The extension stores the full battle-report DOM and parsed JSON in
**IBM DataStax Astra DB**.

Supabase keeps only the metadata + a pointer; Astra holds everything else.
The idea behind a change was so w

This guide walks through provisioning the database and feeding the
credentials into the extension Settings tab.

When db is ready, note two values from the database details page:

- **Database ID** — the UUID shown under the name (e.g.
  `00000000-0000-0000-0000-000000000000`).
- **Region** — e.g. `us-east1`.

## 1. Create the collection

The Document API stores JSON in **collections** inside a keyspace.

1. From the database overview, open **Data Explorer** (or use the
   **Connect → Document API** quick-start tab).
2. Select keyspace `wildguns`.
3. Create a collection named `battle_reports`.

If you used different names, write them down — you'll paste them into
the Settings tab.

## 2. Generate an Application Token

1. From the database page, open **Connect → Token**.
2. Choose role **Database Administrator** (lets the extension read +
   write to the collection).
3. Click **Generate Token**.
4. Copy the **Application Token** (starts with `AstraCS:…`). You will
   not be able to view it again, so store it somewhere safe before
   leaving the page.

##3. Paste credentials into the extension

Open the extension popup → **Settings** tab. Fill in the new Astra
section:

| Field             | Value                                 |
| ----------------- | ------------------------------------- |
| Database ID       | the UUID from step 2                  |
| Region            | e.g. `us-east1`                       |
| Keyspace          | `wildguns` (or whatever you named it) |
| Collection        | `battle_reports`                      |
| Application Token | the `AstraCS:…` token from step 4     |

Click **Save settings**. The Reports tab's **Save report** button will
now dual-write each report: metadata into Supabase, full JSON into
Astra.
