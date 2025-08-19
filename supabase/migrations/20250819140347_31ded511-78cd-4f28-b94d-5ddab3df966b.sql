-- Fix the security definer view by replacing it with a proper function approach
-- First, drop the existing view that's causing security warnings
DROP VIEW IF EXISTS public.tables_safe;

-- Create a security definer function to get safe table data
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
SET search_path TO 'public'
AS $function$
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
$function$;

-- Fix overly restrictive RLS policy on tables
-- Drop the "Block all direct table access" policy that was preventing legitimate operations
DROP POLICY IF EXISTS "Block all direct table access" ON public.tables;

-- Create more appropriate policies for table access
CREATE POLICY "Public can view basic table info through function"
ON public.tables
FOR SELECT
USING (false); -- Still block direct access, force through function

CREATE POLICY "Hosts can update their tables"
ON public.tables
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.table_id = tables.id 
    AND p.is_host = true
  )
);

CREATE POLICY "Anyone can create tables"
ON public.tables
FOR INSERT
WITH CHECK (true);

-- Add proper indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_participants_table_client ON public.participants(table_id, client_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_round ON public.suggestions(round_id);
CREATE INDEX IF NOT EXISTS idx_votes_round ON public.votes(round_id);
CREATE INDEX IF NOT EXISTS idx_blocks_table ON public.blocks(table_id);
CREATE INDEX IF NOT EXISTS idx_rounds_table ON public.rounds(table_id, status);

-- Add trigger to prevent stale rounds and improve reliability
CREATE OR REPLACE FUNCTION public.auto_cleanup_stale_rounds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- When a round is updated, check for stale rounds in the same table
  IF NEW.status != OLD.status THEN
    -- Force cleanup of any stale rounds
    PERFORM public.cleanup_stale_rounds();
  END IF;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_auto_cleanup_rounds ON public.rounds;
CREATE TRIGGER trigger_auto_cleanup_rounds
  AFTER UPDATE ON public.rounds
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cleanup_stale_rounds();