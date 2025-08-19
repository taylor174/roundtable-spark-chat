-- Complete the host secret protection by making RLS policies more restrictive
-- Update the tables RLS policies to be more secure

-- First, ensure host secrets cannot be read directly
CREATE POLICY "Block direct access to host secrets"
ON public.tables
FOR SELECT
USING (false); -- Block all direct SELECT operations

-- Allow only specific operations for hosts through existing policies
-- The existing "Hosts can update their tables" policy should remain

-- Ensure the function is the only way to access table data safely
COMMENT ON FUNCTION public.get_safe_table_data IS 'Safe function to access table data without exposing host_secret';

-- Add additional security: ensure participants table has proper constraints
ALTER TABLE public.participants ADD CONSTRAINT participants_unique_client_table UNIQUE (table_id, client_id);

-- Add constraint to prevent duplicate host entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_unique_host_per_table 
ON public.participants(table_id) 
WHERE is_host = true;