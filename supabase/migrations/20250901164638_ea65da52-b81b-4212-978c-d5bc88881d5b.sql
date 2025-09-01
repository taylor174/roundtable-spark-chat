-- Fix ambiguous column references in database functions
-- The error "column reference 'code' is ambiguous" suggests a JOIN query issue

-- First, let's check and fix the get_safe_table_data function
DROP FUNCTION IF EXISTS public.get_safe_table_data(text);

CREATE OR REPLACE FUNCTION public.get_safe_table_data(p_table_code text DEFAULT NULL)
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
SET search_path = public
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
  FROM public.tables t
  WHERE (p_table_code IS NULL OR t.code = p_table_code);
END;
$$;

-- Fix any other potential ambiguous column issues
-- Ensure all functions that might join tables use proper table prefixes
CREATE OR REPLACE FUNCTION public.get_table_with_round_info(p_table_code text)
RETURNS TABLE(
  table_id uuid,
  table_code text,
  table_status text,
  round_id uuid,
  round_status text,
  round_ends_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as table_id,
    t.code as table_code,
    t.status as table_status,
    r.id as round_id,
    r.status as round_status,
    r.ends_at as round_ends_at
  FROM public.tables t
  LEFT JOIN public.rounds r ON r.id = t.current_round_id
  WHERE t.code = p_table_code;
END;
$$;