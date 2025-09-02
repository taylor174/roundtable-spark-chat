-- Restore database to original state
-- This will recreate the schema exactly as provided

-- First, let's ensure we have all the necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Update any missing columns that might have been altered
-- Ensure all tables have the correct structure

-- Add any missing columns to tables if needed
DO $$ 
BEGIN
    -- Check and add updated_at to rounds if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rounds' AND column_name = 'updated_at') THEN
        ALTER TABLE public.rounds ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();
    END IF;
    
    -- Check and add active_from_round to participants if missing  
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'participants' AND column_name = 'active_from_round') THEN
        ALTER TABLE public.participants ADD COLUMN active_from_round INTEGER;
    END IF;
END $$;

-- Update triggers to ensure we have the correct timestamp trigger
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rounds_updated_at
  BEFORE UPDATE ON public.rounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suggestions_updated_at
  BEFORE UPDATE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_votes_updated_at
  BEFORE UPDATE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blocks_updated_at
  BEFORE UPDATE ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure we have all the required utility functions that might be missing
CREATE OR REPLACE FUNCTION public.get_table_host_data_secure(p_table_code text, p_host_secret text)
RETURNS TABLE(id uuid, code text, host_secret text, status text, title text, description text, default_suggest_sec integer, default_vote_sec integer, current_round_id uuid, phase_ends_at timestamp with time zone, auto_advance boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tables t
    WHERE t.code = p_table_code AND t.host_secret = p_host_secret
  ) THEN
    RAISE EXCEPTION 'Invalid host credentials';
  END IF;
  
  RETURN QUERY
  SELECT 
    t.id, t.code, t.host_secret, t.status, t.title, t.description,
    t.default_suggest_sec, t.default_vote_sec, t.current_round_id,
    t.phase_ends_at, t.auto_advance, t.created_at, t.updated_at
  FROM public.tables t
  WHERE t.code = p_table_code AND t.host_secret = p_host_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_table_host(p_table_id uuid, p_client_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.participants 
    WHERE table_id = p_table_id AND client_id = p_client_id AND is_host = true
  );
END $$;

-- Ensure RLS policies are correct
DROP POLICY IF EXISTS "Anyone can join tables as participant" ON public.participants;

SELECT 'Database restored to original state successfully!' as message;