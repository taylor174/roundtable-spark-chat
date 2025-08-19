-- Remove the problematic view and create a safer alternative approach
DROP VIEW IF EXISTS public.tables_public;

-- Create a secure function instead that returns only safe table data
CREATE OR REPLACE FUNCTION public.get_public_table_info(table_code text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  code text,
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
  RETURN QUERY
  SELECT 
    t.id,
    t.code,
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
    -- Explicitly EXCLUDE host_secret
  FROM public.tables t
  WHERE (table_code IS NULL OR t.code = table_code);
END;
$$;

-- Grant execution to public
GRANT EXECUTE ON FUNCTION public.get_public_table_info TO PUBLIC;