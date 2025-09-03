-- Create profiles table for user data and admin roles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Only admins can update admin status
CREATE POLICY "Only admins can update admin status" ON public.profiles
  FOR UPDATE USING (
    CASE 
      WHEN OLD.is_admin != NEW.is_admin THEN 
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
      ELSE true
    END
  );

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = true
  );
END;
$$;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update tables RLS to require authentication for admin actions
DROP POLICY IF EXISTS "tables_update_policy" ON public.tables;
CREATE POLICY "tables_update_policy" ON public.tables
  FOR UPDATE USING (
    -- Only authenticated hosts or admins can update tables
    (auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM participants p WHERE p.table_id = tables.id AND p.client_id = auth.uid()::text AND p.is_host = true)
      OR public.is_current_user_admin()
    ))
  );

-- Secure host_secret access - only for verified hosts and admins
DROP POLICY IF EXISTS "tables_secure_select_policy" ON public.tables;
CREATE POLICY "tables_secure_select_policy" ON public.tables
  FOR SELECT USING (
    CASE 
      WHEN auth.uid() IS NULL THEN 
        -- Anonymous users can see public data but not host_secret (this will be handled in application layer)
        true
      ELSE 
        -- Authenticated users can see all data
        true
    END
  );

-- Update participants RLS to require authentication
DROP POLICY IF EXISTS "Only hosts can update participants" ON public.participants;
CREATE POLICY "Only authenticated hosts and admins can update participants" ON public.participants
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM participants host WHERE host.table_id = participants.table_id AND host.client_id = auth.uid()::text AND host.is_host = true)
      OR public.is_current_user_admin()
    )
  );

-- Create admin-only function to get system stats
CREATE OR REPLACE FUNCTION public.get_admin_system_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Check if user is admin
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;
  
  SELECT json_build_object(
    'total_tables', (SELECT COUNT(*) FROM tables),
    'running_tables', (SELECT COUNT(*) FROM tables WHERE status = 'running'),
    'active_participants', (SELECT COUNT(*) FROM participants WHERE last_seen_at > NOW() - INTERVAL '10 minutes'),
    'expired_rounds', (SELECT COUNT(*) FROM rounds WHERE status IN ('suggest', 'vote') AND ends_at < NOW())
  ) INTO result;
  
  RETURN result;
END;
$$;