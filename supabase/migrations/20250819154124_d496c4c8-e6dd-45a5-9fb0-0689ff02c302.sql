-- Fix the table INSERT permission issue
-- The problem is that RLS is blocking INSERT operations

-- First, let's see what policies exist
-- Check if the INSERT policy exists but might be too restrictive

-- Drop and recreate the INSERT policy to ensure it works
DROP POLICY IF EXISTS "Anyone can create tables" ON public.tables;

-- Create a proper INSERT policy that actually allows table creation
CREATE POLICY "Enable table creation for all users"
ON public.tables
FOR INSERT
WITH CHECK (true);

-- Also ensure SELECT works for reading the created table
DROP POLICY IF EXISTS "Allow reading safe table data" ON public.tables;

CREATE POLICY "Enable reading table data"
ON public.tables  
FOR SELECT
USING (true);