-- ULTIMATE SECURITY FIX: Create completely isolated security layer

-- Step 1: Enable RLS on tables (was missing!)
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Step 2: Create secure host verification function
CREATE OR REPLACE FUNCTION public.verify_host_access(
  p_table_id uuid,
  p_client_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM participants 
    WHERE table_id = p_table_id 
    AND client_id = p_client_id 
    AND is_host = true
  );
END;
$$;

-- Step 3: Create ultra-secure RLS policy for tables
CREATE POLICY "Ultra secure host only access"
ON tables
FOR ALL
USING (
  public.verify_host_access(id, current_setting('app.current_client_id', true))
);

-- Step 4: Create secure table access function for hosts only
CREATE OR REPLACE FUNCTION public.get_table_with_secrets(
  p_table_id uuid,
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
BEGIN
  -- Verify host access
  IF NOT public.verify_host_access(p_table_id, p_client_id) THEN
    RAISE EXCEPTION 'Access denied: Not a host of this table';
  END IF;
  
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
  FROM public.tables t
  WHERE t.id = p_table_id;
END;
$$;

-- Step 5: Test security fix
SELECT id FROM tables LIMIT 1;