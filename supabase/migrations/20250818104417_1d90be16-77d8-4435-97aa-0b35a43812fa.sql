-- Fix table creation by allowing INSERT for tables
-- The issue is likely that we need to allow table creation without participant checking

-- Add INSERT policy for tables (anyone can create a table)
CREATE POLICY "Anyone can create tables"
ON public.tables
FOR INSERT
WITH CHECK (true);

-- Add INSERT policy for participants (needed for host to join their own table)
CREATE POLICY "Anyone can insert participants"
ON public.participants
FOR INSERT
WITH CHECK (true);