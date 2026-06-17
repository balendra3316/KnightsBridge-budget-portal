-- 006_assign_regions.sql
-- Region support for the Budget Entry filter.
--
-- NOTE: the `region` column already exists on `clients` (migration 004 seeds it
-- with 'New York', 'California', 'Florida', 'Texas'). This script is idempotent —
-- it just guarantees the column is there and gives you a clean way to (re)assign
-- regions on existing rows. Run it in the Supabase SQL editor.

-- 1) Make sure the column exists (no-op if it already does).
alter table clients add column if not exists region text;

-- 2) Optional: speed up region filtering once you have many clients.
create index if not exists idx_clients_region on clients (region);

-- 3) Optional: restrict region to the four supported states so typos can't sneak
--    in. Comment this out if you want region to stay free-form.
-- alter table clients drop constraint if exists clients_region_check;
-- alter table clients add constraint clients_region_check
--   check (region is null or region in ('New York', 'Texas', 'California', 'Florida'));

-- 4) Assign regions to existing clients. Edit the name lists below — names must
--    match clients.name exactly (case-sensitive). Anything not listed keeps its
--    current value. These are the four regions the UI filter shows.

update clients set region = 'New York' where name in (
  'ONE WALL STREET'
  -- , 'PRINT HOUSE'
);

update clients set region = 'Texas' where name in (
  -- 'CLIENT NAME HERE'
);

update clients set region = 'California' where name in (
  -- 'CLIENT NAME HERE'
);

update clients set region = 'Florida' where name in (
  -- 'CLIENT NAME HERE'
);

-- 5) Optional: park anything still unassigned so it never disappears behind a
--    region filter (the 'All' chip always shows everything regardless).
-- update clients set region = 'New York' where region is null;

-- Verify the spread:
-- select region, count(*) from clients group by region order by count(*) desc;
