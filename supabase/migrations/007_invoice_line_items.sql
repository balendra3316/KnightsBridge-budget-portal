-- 007_invoice_line_items.sql
-- Freeze the printable line items on each invoice at creation time, so the PDF
-- preview renders from saved data and never drifts from the locked totals.
--
-- Shape: a JSON array of { "name": string, "amount": number }, already with the
-- card rules applied (Client-Card spend is represented only by its commission;
-- KB-Card spend is shown in full). Run this in the Supabase SQL editor.

alter table invoices add column if not exists line_items jsonb;

-- Older invoices created before this column simply have NULL line_items; the PDF
-- page falls back to rebuilding rows from the saved aggregate fields
-- (fee_amount, commission_amount, invoice_total) for those.
