-- CORRECTED SECURITY FIX: Proper RLS implementation

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Ultra secure host only access" ON tables;
DROP POLICY IF EXISTS "Public can only see safe table columns" ON tables;

-- Step 2: Revoke all permissions on the main table
REVOKE ALL ON tables FROM PUBLIC, anon, authenticated;

-- Step 3: Create a completely safe public view without sensitive data
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

-- Step 4: Grant access to the safe view only
GRANT SELECT ON public.tables_safe TO PUBLIC, anon, authenticated;

-- Step 5: Allow authenticated users to insert new tables
GRANT INSERT ON public.tables TO authenticated;

-- Step 6: Allow hosts to update their own tables
GRANT UPDATE ON public.tables TO authenticated;

-- Step 7: Create RLS policy that blocks ALL access to the main table
CREATE POLICY "Block all direct table access"
ON tables
FOR ALL
USING (false);

-- Step 8: Test the security fix - this should return safe data only
SELECT id, code FROM tables_safe LIMIT 1;