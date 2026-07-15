-- RLS for community_forklaring (paste into Supabase SQL Editor)
-- Public can read only approved contributions (for transparency)
-- Authenticated users can propose (insert as pending)
-- Moderators/admins can update status and moderate

ALTER TABLE public.community_forklaring ENABLE ROW LEVEL SECURITY;

-- 1. Anyone (including anon) can read approved forklaringar
CREATE POLICY "public_read_approved_forklaringar"
ON public.community_forklaring
FOR SELECT
USING (status = 'approved');

-- 2. Authenticated users can insert new proposals (they become pending by default)
CREATE POLICY "authenticated_insert_pending"
ON public.community_forklaring
FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated'
  AND status = 'pending'   -- force pending on insert
);

-- 3. Only moderators or admins can UPDATE (e.g. approve/reject, add moderation_note)
CREATE POLICY "moderator_update_status"
ON public.community_forklaring
FOR UPDATE
USING (
  (auth.jwt() ->> 'role' = 'moderator') OR 
  (auth.jwt() ->> 'role' = 'admin') OR
  (auth.jwt() ->> 'user_role' = 'moderator')
)
WITH CHECK (
  (auth.jwt() ->> 'role' = 'moderator') OR 
  (auth.jwt() ->> 'role' = 'admin') OR
  (auth.jwt() ->> 'user_role' = 'moderator')
);

-- 4. No public delete (only admins via service role if needed)
-- Optional: block all deletes for safety
CREATE POLICY "no_public_delete"
ON public.community_forklaring
FOR DELETE
USING (false);

-- Note: After applying, test with anon key (should only see approved rows)
-- For full provenance on inserts, application code should set kalla, added_by etc. before insert.
-- See main schema.sql for table definition (forfattare, status, upvotes, moderated_by etc.)

-- Public contribution path:
-- We use a server-side API route (/api/contribute) with SUPABASE_SERVICE_ROLE_KEY.
-- This bypasses RLS for inserts and forces status='pending' + provenance.
-- This keeps the site open (no login wall) while reads remain safe (only approved visible to public).
-- If you prefer strict authenticated-only inserts, remove or ignore the service path and require Supabase Auth.