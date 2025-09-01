-- Fix the ambiguous column reference in get_table_host_data_secure function
CREATE OR REPLACE FUNCTION public.get_table_host_data_secure(p_table_code text, p_host_secret text)
 RETURNS TABLE(id uuid, code text, host_secret text, status text, title text, description text, default_suggest_sec integer, default_vote_sec integer, current_round_id uuid, phase_ends_at timestamp with time zone, auto_advance boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Verify host secret matches before returning data
  IF NOT EXISTS (
    SELECT 1 FROM public.tables t
    WHERE t.code = p_table_code AND t.host_secret = p_host_secret
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
$function$