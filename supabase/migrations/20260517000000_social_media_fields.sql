-- Add social media columns to companies (LinkedIn biz page, Instagram, Twitter/X, YouTube)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS linkedin  text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS twitter   text,
  ADD COLUMN IF NOT EXISTS youtube   text;

-- Add personal LinkedIn to contacts (the existing `twitter` column already exists for personal Twitter)
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS linkedin  text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS youtube   text;
