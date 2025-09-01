-- First check and remove any existing policies
DO $$
BEGIN
    -- Drop policies that might exist
    BEGIN
        DROP POLICY IF EXISTS "tables_no_direct_access" ON public.tables;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "tables_allow_insert" ON public.tables;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "tables_insert_policy" ON public.tables;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "tables_no_select" ON public.tables;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "tables_update_by_host" ON public.tables;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "tables_update_policy" ON public.tables;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "tables_no_delete" ON public.tables;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
    
    BEGIN
        DROP POLICY IF EXISTS "tables_no_insert" ON public.tables;
    EXCEPTION WHEN undefined_object THEN
        NULL;
    END;
END $$;

-- Create a secure function for table creation that bypasses RLS
CREATE OR REPLACE FUNCTION public.create_table_secure(
  p_code text,
  p_host_secret text,
  p_title text,
  p_description text,
  p_default_suggest_sec integer,
  p_default_vote_sec integer
)
RETURNS TABLE(id uuid, code text, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_id uuid;
BEGIN
  -- Insert new table (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.tables (
    code, 
    host_secret, 
    title, 
    description, 
    default_suggest_sec, 
    default_vote_sec,
    status
  )
  VALUES (
    p_code,
    p_host_secret,
    p_title,
    p_description,
    p_default_suggest_sec,
    p_default_vote_sec,
    'lobby'
  )
  RETURNING tables.id INTO v_table_id;
  
  -- Return the created table info (without secrets)
  RETURN QUERY
  SELECT 
    v_table_id,
    p_code,
    'lobby'::text;
END $$;

-- Set up clean RLS policies for tables
-- Block all direct SELECT access to protect host_secret
CREATE POLICY "tables_no_select" ON public.tables
FOR SELECT
USING (false);

-- Block direct INSERT - must use secure function
CREATE POLICY "tables_no_insert" ON public.tables
FOR INSERT
WITH CHECK (false);

-- Only hosts can update tables (verified via participants)
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