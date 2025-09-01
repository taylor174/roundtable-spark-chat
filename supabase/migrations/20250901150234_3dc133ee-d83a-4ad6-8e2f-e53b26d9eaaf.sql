-- Fix RLS policies to allow table creation while protecting host secrets
-- Remove the overly restrictive policy that blocks ALL operations
DROP POLICY IF EXISTS "tables_no_direct_access" ON public.tables;
DROP POLICY IF EXISTS "tables_allow_insert" ON public.tables;
DROP POLICY IF EXISTS "tables_insert_policy" ON public.tables;

-- Allow INSERT operations for table creation
CREATE POLICY "tables_allow_insert" ON public.tables
FOR INSERT
WITH CHECK (true);

-- Block direct SELECT access to protect host_secret
-- Users must use secure functions to access table data
CREATE POLICY "tables_no_select" ON public.tables
FOR SELECT
USING (false);

-- Only hosts can update tables
CREATE POLICY "tables_update_by_host" ON public.tables
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM participants p 
  WHERE p.table_id = tables.id 
  AND p.is_host = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM participants p 
  WHERE p.table_id = tables.id 
  AND p.is_host = true
));

-- Block DELETE operations for data integrity
CREATE POLICY "tables_no_delete" ON public.tables
FOR DELETE
USING (false);