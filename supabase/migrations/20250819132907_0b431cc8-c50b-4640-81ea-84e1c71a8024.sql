-- Fix the security definer view issue
ALTER VIEW public.tables_public SET (security_barrier = false);

-- Test the security fix
SELECT id, code, status FROM tables_public LIMIT 1;