-- ── Storage buckets ─────────────────────────────────────────────────────────

-- Avatars: public bucket, 5 MB per file
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('avatars', 'avatars', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Documents: private bucket, 1 GB per file
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documents', 'documents', false, 1073741824)
ON CONFLICT (id) DO NOTHING;

-- ── Documents metadata table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text        NOT NULL CHECK (entity_type IN ('account', 'deal', 'lead', 'task')),
  entity_id     uuid        NOT NULL,
  file_name     text        NOT NULL,
  file_size     bigint      NOT NULL,
  mime_type     text,
  storage_path  text        NOT NULL UNIQUE,
  uploaded_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read documents
CREATE POLICY "documents_select"
  ON public.documents FOR SELECT TO authenticated
  USING (true);

-- Users can upload their own documents
CREATE POLICY "documents_insert"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- Users can delete their own; super_user/admin can delete any
CREATE POLICY "documents_delete"
  ON public.documents FOR DELETE TO authenticated
  USING (
    auth.uid() = uploaded_by
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('super_user', 'admin')
    )
  );

-- ── Storage RLS — avatars ────────────────────────────────────────────────────

CREATE POLICY "avatars_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');

-- ── Storage RLS — documents ──────────────────────────────────────────────────

CREATE POLICY "documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
