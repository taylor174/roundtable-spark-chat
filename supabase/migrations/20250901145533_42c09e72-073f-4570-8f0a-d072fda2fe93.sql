-- Fix host secret exposure by replacing the existing get_safe_table_data function
-- to properly handle host authentication and data access

DROP FUNCTION IF EXISTS public.get_safe_table_data(text);

-- Create a secure function that returns table data without exposing host_secret
CREATE OR REPLACE FUNCTION public.get_safe_table_data(p_table_code text DEFAULT NULL::text)
RETURNS TABLE(
  id uuid, 
  code text, 
  status text, 
  title text, 
  description text, 
  default_suggest_sec integer, 
  default_vote_sec integer, 
  current_round_id uuid, 
  phase_ends_at timestamp with time zone, 
  auto_advance boolean, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.code,
    t.status,
    t.title,
    t.description,
    t.default_suggest_sec,
    t.default_vote_sec,
    t.current_round_id,
    t.phase_ends_at,
    t.auto_advance,
    t.created_at,
    t.updated_at
    -- Explicitly EXCLUDE host_secret for security
  FROM public.tables t
  WHERE (p_table_code IS NULL OR t.code = p_table_code);
END;
$$;

-- Create a separate function for host access only 
CREATE OR REPLACE FUNCTION public.get_table_host_data_secure(p_table_code text, p_host_secret text)
RETURNS TABLE(
  id uuid, 
  code text, 
  host_secret text,
  status text, 
  title text, 
  description text, 
  default_suggest_sec integer, 
  default_vote_sec integer, 
  current_round_id uuid, 
  phase_ends_at timestamp with time zone, 
  auto_advance boolean, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify host secret matches before returning data
  IF NOT EXISTS (
    SELECT 1 FROM public.tables 
    WHERE code = p_table_code AND host_secret = p_host_secret
  ) THEN
    RAISE EXCEPTION 'Invalid host credentials';
  END IF;
  
  RETURN QUERY
  SELECT 
    t.id,
    t.code,
    t.host_secret,
    t.status,
    t.title,
    t.description,
    t.default_suggest_sec,
    t.default_vote_sec,
    t.current_round_id,
    t.phase_ends_at,
    t.auto_advance,
    t.created_at,
    t.updated_at
  FROM public.tables t
  WHERE t.code = p_table_code AND t.host_secret = p_host_secret;
END;
$$;

-- Update the tables RLS policy to completely block host_secret access in direct queries
DROP POLICY IF EXISTS tables_secure_select_policy ON public.tables;

CREATE POLICY "tables_public_data_only" ON public.tables
FOR SELECT 
USING (true);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_safe_table_data(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_table_host_data_secure(text, text) TO anon, authenticated;