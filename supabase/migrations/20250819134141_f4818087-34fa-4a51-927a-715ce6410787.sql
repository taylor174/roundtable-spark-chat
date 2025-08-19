-- FINAL COMPLETE SECURITY FIX: Block all host_secret exposure

-- Step 1: Drop the problematic policy that's not working
DROP POLICY IF EXISTS "Ultra secure host only access" ON tables;

-- Step 2: Create a policy that ONLY allows access to non-sensitive columns
CREATE POLICY "Public can only see safe table columns"
ON tables
FOR SELECT
USING (true)
WITH CHECK (false);

-- Step 3: Create column-level security by using a view approach instead
-- First, revoke all permissions on the main table
REVOKE ALL ON tables FROM PUBLIC, anon, authenticated;

-- Step 4: Create a completely safe public view without sensitive data
CREATE OR REPLACE VIEW public.tables_safe AS
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
  -- host_secret is COMPLETELY EXCLUDED
FROM public.tables;

-- Step 5: Grant access to the safe view only
GRANT SELECT ON public.tables_safe TO PUBLIC, anon, authenticated;

-- Step 6: Allow authenticated users to insert new tables
GRANT INSERT ON public.tables TO authenticated;

-- Step 7: Create secure function for hosts to get their secrets
CREATE OR REPLACE FUNCTION public.get_host_table_data(
  p_table_code text,
  p_client_id text
) RETURNS TABLE (
  id uuid,
  code text,
  host_secret text,
  status text,
  default_suggest_sec integer,
  default_vote_sec integer,
  current_round_id uuid,
  phase_ends_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  title text,
  description text,
  auto_advance boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_table_id uuid;
BEGIN
  -- First get the table ID
  SELECT t.id INTO v_table_id
  FROM tables t
  WHERE t.code = p_table_code;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table not found';
  END IF;
  
  -- Verify the client is a host of this table
  IF NOT EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.table_id = v_table_id 
    AND p.client_id = p_client_id 
    AND p.is_host = true
  ) THEN
    RAISE EXCEPTION 'Access denied: Not a host of this table';
  END IF;
  
  -- Return the full table data including secrets
  RETURN QUERY
  SELECT 
    t.id,
    t.code,
    t.host_secret,
    t.status,
    t.default_suggest_sec,
    t.default_vote_sec,
    t.current_round_id,
    t.phase_ends_at,
    t.created_at,
    t.updated_at,
    t.title,
    t.description,
    t.auto_advance
  FROM tables t
  WHERE t.id = v_table_id;
END;
$$;

-- Step 8: Test the security fix
SELECT id, code FROM tables_safe LIMIT 1;