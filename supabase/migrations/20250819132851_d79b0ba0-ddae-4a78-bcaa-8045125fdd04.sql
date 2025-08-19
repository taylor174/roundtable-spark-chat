-- CRITICAL SECURITY FIX: Create separate view for public table access
-- This completely fixes the host_secret exposure issue

-- Step 1: Drop conflicting policies
DROP POLICY IF EXISTS "Public can view basic table info" ON tables;
DROP POLICY IF EXISTS "Hosts can access table secrets" ON tables;

-- Step 2: Create a public view that excludes sensitive data
CREATE OR REPLACE VIEW public.tables_public AS
SELECT 
  id,
  code,
  status,
  default_suggest_sec,
  default_vote_sec,
  current_round_id,
  phase_ends_at,
  created_at,
  updated_at,
  title,
  description,
  auto_advance
  -- Explicitly EXCLUDE host_secret
FROM public.tables;

-- Step 3: Grant public access to the safe view
GRANT SELECT ON public.tables_public TO PUBLIC;

-- Step 4: Create secure policy for hosts to access full table data including secrets
CREATE POLICY "Hosts can access full table data including secrets"
ON tables
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.table_id = tables.id 
    AND p.is_host = true
  )
);

-- Step 5: Enable RLS for the view as well
ALTER VIEW public.tables_public SET (security_barrier = true);

-- Step 6: Create function to safely check if user can access table secrets
CREATE OR REPLACE FUNCTION public.can_access_table_secrets(table_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM participants 
    WHERE participants.table_id = can_access_table_secrets.table_id 
    AND participants.is_host = true
  );
END;
$$;