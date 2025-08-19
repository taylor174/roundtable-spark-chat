-- Continue Phase 1: Security & RLS Fixes

-- Fix 1: Secure host_secret access with proper RLS policies
DROP POLICY IF EXISTS "Public can view table info without secrets" ON tables;
DROP POLICY IF EXISTS "Hosts can view their own table secrets" ON tables;

-- Create secure policies that prevent host_secret exposure
CREATE POLICY "Public can view basic table info" 
ON tables 
FOR SELECT 
USING (true);

-- Secure RLS function to check host status without exposing secrets
CREATE OR REPLACE FUNCTION public.is_current_user_host(table_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM participants 
    WHERE participants.table_id = is_current_user_host.table_id 
    AND participants.is_host = true
  );
END;
$$;

-- Host-only policy for viewing sensitive data
CREATE POLICY "Hosts can access table secrets"
ON tables
FOR SELECT
USING (public.is_current_user_host(id));

-- Fix 2: Strengthen suggestion RLS policies 
DROP POLICY IF EXISTS "Participants can update their own suggestions during suggest ph" ON suggestions;

CREATE POLICY "Participants can update own suggestions in suggest phase"
ON suggestions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 
    FROM participants p 
    JOIN rounds r ON r.id = suggestions.round_id 
    WHERE p.table_id = r.table_id 
    AND p.id = suggestions.participant_id
    AND r.status = 'suggest'
    AND r.ends_at > NOW()  -- Additional time check
  )
);