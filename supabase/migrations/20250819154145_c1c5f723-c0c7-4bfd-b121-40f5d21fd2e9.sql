-- Check and fix RLS policies for tables
-- The issue might be conflicting policies or RLS configuration

-- First check if RLS is enabled (it should be)
-- If there are conflicting policies, drop them all and recreate clean ones

-- Drop ALL policies on tables to start fresh
DROP POLICY IF EXISTS "Anyone can create tables" ON public.tables;
DROP POLICY IF EXISTS "Enable table creation for all users" ON public.tables;
DROP POLICY IF EXISTS "Allow reading safe table data" ON public.tables;
DROP POLICY IF EXISTS "Enable reading table data" ON public.tables;
DROP POLICY IF EXISTS "Only hosts can update tables" ON public.tables;
DROP POLICY IF EXISTS "Hosts can update their tables" ON public.tables;

-- Create clean, working policies
CREATE POLICY "tables_insert_policy" 
ON public.tables 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "tables_select_policy" 
ON public.tables 
FOR SELECT 
USING (true);

CREATE POLICY "tables_update_policy" 
ON public.tables 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.participants p 
    WHERE p.table_id = tables.id AND p.is_host = true
  )
);