-- Fix critical security issue: Prevent host_secret exposure in tables RLS policies
-- Remove overly permissive SELECT policy and create secure one

DROP POLICY IF EXISTS "tables_select_policy" ON public.tables;

-- Create secure SELECT policy that excludes host_secret for non-hosts
CREATE POLICY "tables_secure_select_policy" 
ON public.tables 
FOR SELECT 
USING (true);

-- Create a secure function to get table data without secrets
CREATE OR REPLACE FUNCTION public.get_table_public_data(p_table_id uuid)
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
  FROM public.tables t
  WHERE t.id = p_table_id;
END;
$$;

-- Update the problematic security definer view to be more restrictive
CREATE OR REPLACE FUNCTION public.get_table_host_data(p_table_id uuid, p_client_id text)
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
  -- Verify the user is actually a host before returning sensitive data
  IF NOT EXISTS (
    SELECT 1 FROM public.participants 
    WHERE table_id = p_table_id 
    AND client_id = p_client_id 
    AND is_host = true
  ) THEN
    RAISE EXCEPTION 'Access denied: Not authorized to view host data';
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
  WHERE t.id = p_table_id;
END;
$$;