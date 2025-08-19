-- FINAL FIX: Completely block direct table access and force use of secure function

-- Drop the host-only policy that's not working properly
DROP POLICY IF EXISTS "Hosts can access full table data including secrets" ON tables;

-- Block ALL direct access to tables
-- Only specific functions can access the table now
REVOKE ALL ON tables FROM PUBLIC;
REVOKE ALL ON tables FROM anon;
REVOKE ALL ON tables FROM authenticated;

-- Grant only INSERT to authenticated users (for creating tables)
GRANT INSERT ON tables TO authenticated;

-- Test that direct access is blocked
SELECT id, host_secret FROM tables LIMIT 1;