-- Track which Account / Contact / Deal a lead became when it was converted,
-- so we can link back to them from the lead view.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS converted_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_contact_id uuid REFERENCES public.contacts(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_deal_id    uuid REFERENCES public.deals(id)     ON DELETE SET NULL;
