-- supabase_setup.sql
-- Run in: Supabase Dashboard → SQL Editor → New query

-- ── Table ──────────────────────────────────────────────────────────────────
-- Each row = one scrape session (all players at that moment).
-- players is a JSONB array matching the structure from content.js:
-- [
--   {
--     "player": "adam13", "user_id": 1456,
--     "city": "Osada Quick Knuckles", "village_id": 40285,
--     "units": [
--       { "unit": "Farmer", "count": 5, "unit_type_id": 11 },
--       ...
--     ]
--   }, ...
-- ]

create table if not exists unit_snapshots (
  id            bigint       generated always as identity primary key,
  players       jsonb        not null,
  total_players int          not null default 0,
  total_units   int          not null default 0,
  page_url      text,
  scraped_at    timestamptz  not null,
  inserted_at   timestamptz  not null default now()
);

create index if not exists unit_snapshots_scraped_at_idx on unit_snapshots (scraped_at desc);

-- ── Row Level Security ─────────────────────────────────────────────────────
alter table unit_snapshots enable row level security;

-- Option A (default): anon key can INSERT only — no SELECT from outside.
-- Safe to ship the anon key inside the extension.
create policy "anon insert only"
  on unit_snapshots for insert to anon
  with check (true);

-- Option B: full user auth — uncomment + run after enabling Supabase Auth.
-- Also add: alter table unit_snapshots add column user_id uuid references auth.users;
-- create policy "user insert own" on unit_snapshots for insert to authenticated
--   with check (auth.uid() = user_id);
-- create policy "user select own" on unit_snapshots for select to authenticated
--   using (auth.uid() = user_id);


-- ── Handy queries ──────────────────────────────────────────────────────────

-- Latest snapshot:
-- select * from unit_snapshots order by scraped_at desc limit 1;

-- Expand players array into rows:
-- select scraped_at,
--        p->>'player'     as player,
--        p->>'city'       as city,
--        (p->>'village_id')::int as village_id
-- from unit_snapshots,
--      jsonb_array_elements(players) p
-- order by scraped_at desc;

-- Expand all the way to individual units:
-- select scraped_at,
--        p->>'player'           as player,
--        p->>'city'             as city,
--        u->>'unit'             as unit,
--        (u->>'count')::int     as count,
--        (u->>'unit_type_id')::int as unit_type_id
-- from unit_snapshots,
--      jsonb_array_elements(players) p,
--      jsonb_array_elements(p->'units') u
-- order by scraped_at desc, player, unit;

-- ── License table (for paywalled features) ───────────────────────────────────
-- Queried exclusively by the Supabase Edge Function (license-gate) using the
-- SERVICE_ROLE_KEY, which bypasses RLS. The anon key cannot touch this table.

create table if not exists licenses (
  id           bigint      generated always as identity primary key,
  license_key  text        not null unique,
  is_active    boolean     not null default true,
  expires_at   timestamptz,            -- null = never expires
  created_at   timestamptz not null default now(),
  note         text                    -- admin label: username, order ID, etc.
);

alter table licenses enable row level security;
-- Zero RLS policies = deny all for anon/authenticated roles by default.
