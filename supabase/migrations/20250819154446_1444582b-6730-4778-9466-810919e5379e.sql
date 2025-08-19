-- Grant necessary table privileges to anon and authenticated roles
-- This is required for RLS policies to work properly

-- Grant privileges on tables table
GRANT INSERT, SELECT, UPDATE ON public.tables TO anon, authenticated;

-- Grant privileges on participants table (needed for table creation flow)
GRANT INSERT, SELECT, UPDATE ON public.participants TO anon, authenticated;

-- Grant privileges on other tables that might be needed
GRANT INSERT, SELECT, UPDATE ON public.rounds TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE ON public.suggestions TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE ON public.votes TO anon, authenticated;
GRANT INSERT, SELECT, UPDATE ON public.blocks TO anon, authenticated;

-- Grant SELECT on profiles (for display names)
GRANT SELECT ON public.profiles TO anon, authenticated;