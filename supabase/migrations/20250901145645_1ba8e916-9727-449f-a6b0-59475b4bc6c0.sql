-- Remove SELECT permission on tables to completely prevent direct access to host_secret
-- Users should only access table data through the secure functions

DROP POLICY IF EXISTS tables_public_data_only ON public.tables;

-- Block all direct table access for non-hosts
CREATE POLICY "tables_no_direct_access" ON public.tables
FOR ALL
USING (false)
WITH CHECK (false);

-- Allow insert for creating new tables
CREATE POLICY "tables_allow_insert" ON public.tables
FOR INSERT
WITH CHECK (true);