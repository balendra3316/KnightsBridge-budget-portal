-- Run this in the Supabase SQL editor after the earlier migrations.
-- Adds the "monthly total" reference figure to invoices. This is the sheet's
-- Monthly Total (fee + ad spend) and is NOT the billed amount — invoice_total is.

alter table invoices add column if not exists monthly_total numeric;
