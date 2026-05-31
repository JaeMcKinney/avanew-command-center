-- ── RA Photos Storage Bucket ──────────────────────────────────────────────────
-- Creates a public bucket for RA profile photos with per-user path isolation.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ra-photos',
  'ra-photos',
  true,
  5242880,   -- 5 MB max
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RAs can upload / overwrite only their own folder ({user_id}/avatar.*)
CREATE POLICY "ra_photos_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ra-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "ra_photos_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ra-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "ra_photos_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ra-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone (including anon) can read — photos appear on public referral pages
CREATE POLICY "ra_photos_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'ra-photos');
