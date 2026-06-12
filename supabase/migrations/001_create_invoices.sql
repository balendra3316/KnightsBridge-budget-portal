-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

create table invoices (
  id uuid default gen_random_uuid() primary key,
  invoice_number text,
  client_name text,
  billing_month text,
  pm_name text,
  commission_rate numeric,
  billing_pattern text,
  fee_amount numeric,
  ad_spend_amount numeric,
  commission_amount numeric,
  invoice_total numeric,
  memo text,
  status text default 'draft',
  approver_note text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Enable Row Level Security (optional - uncomment if using auth)
-- alter table invoices enable row level security;

-- Auto-update updated_at on row changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger invoices_updated_at
  before update on invoices
  for each row execute function update_updated_at();

-- Optional: seed some demo data
insert into invoices (invoice_number, client_name, billing_month, pm_name, commission_rate, billing_pattern, fee_amount, ad_spend_amount, commission_amount, invoice_total, status)
values
  ('KB61275', 'One Wall Street', 'DEC 2025', 'Jordan', 15, 'standard', 7500, 21500, 3225, 10725, 'paid'),
  ('KB61353', 'One Wall Street', 'JAN 2026', 'Jordan', 15, 'standard', 7500, 22000, 3300, 10800, 'paid'),
  ('KB61445', 'One Wall Street', 'MAR 2026', 'Jordan', 15, 'standard', 7500, 24250, 3637.50, 11137.50, 'sent'),
  ('KB61267', 'Algin Management', 'DEC 2025', 'Jordan / Bailey', 0, 'standard', 10750, 0, 0, 10750, 'paid'),
  ('KB61382', 'Algin Management', 'FEB 2026', 'Jordan / Bailey', 0, 'standard', 10750, 0, 0, 10750, 'sent'),
  ('KB61290', 'Print House', 'DEC 2025', 'Jordan / Bailey', 0, 'split-invoices', 1500, 5000, 0, 6500, 'paid');
