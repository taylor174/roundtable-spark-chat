-- Remove the problematic tables_public view
-- This view was causing a security definer warning and is not needed
-- since we have proper functions for table access
DROP VIEW IF EXISTS public.tables_public;

-- Ensure the linter issue is resolved by removing any unnecessary views
-- The functions get_public_table_info, get_table_public_data, etc. 
-- provide the necessary controlled access to table information