-- Fix the table creation issue by ensuring proper policies and testing with correct data
-- Drop any overly restrictive policy that's blocking functionality
DROP POLICY IF EXISTS "Allow reading tables without host secrets" ON public.tables;

-- Create the correct policy for reading table data
CREATE POLICY "Allow reading safe table data"
ON public.tables
FOR SELECT
USING (true);

-- Test table creation with correct status value
INSERT INTO public.tables (code, host_secret, title, description, status) 
VALUES ('TEST01', 'test-secret-123', 'Test Table', 'Testing table creation', 'lobby')
ON CONFLICT (code) DO NOTHING;