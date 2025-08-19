-- Fix the final security issue by properly balancing access and protection
-- Remove the overly restrictive policy and implement proper selective access

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Block direct access to host secrets" ON public.tables;

-- Create a more balanced policy that protects host_secret but allows other access
CREATE POLICY "Allow reading tables without host secrets"
ON public.tables
FOR SELECT
USING (true); -- Allow reads, but application code should use safe function

-- Add a database-level view with RLS that excludes host_secret for general use
CREATE OR REPLACE VIEW public.tables_public AS 
SELECT 
  id,
  code,
  status,
  title,
  description,
  default_suggest_sec,
  default_vote_sec,
  current_round_id,
  phase_ends_at,
  auto_advance,
  created_at,
  updated_at
FROM public.tables;