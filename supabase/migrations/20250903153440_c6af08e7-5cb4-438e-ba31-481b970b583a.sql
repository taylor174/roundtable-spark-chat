-- Fix any missing database components and ensure schema integrity

-- Ensure all essential functions exist and are up to date
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Ensure triggers exist for timestamp updates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_participants_updated_at') THEN
    CREATE TRIGGER update_participants_updated_at
      BEFORE UPDATE ON public.participants
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_rounds_updated_at') THEN  
    CREATE TRIGGER update_rounds_updated_at
      BEFORE UPDATE ON public.rounds
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_suggestions_updated_at') THEN
    CREATE TRIGGER update_suggestions_updated_at
      BEFORE UPDATE ON public.suggestions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_votes_updated_at') THEN
    CREATE TRIGGER update_votes_updated_at
      BEFORE UPDATE ON public.votes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_blocks_updated_at') THEN
    CREATE TRIGGER update_blocks_updated_at
      BEFORE UPDATE ON public.blocks
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Ensure proper column defaults and constraints
ALTER TABLE public.profiles ALTER COLUMN is_admin SET DEFAULT false;
ALTER TABLE public.tables ALTER COLUMN status SET DEFAULT 'lobby';
ALTER TABLE public.rounds ALTER COLUMN status SET DEFAULT 'suggest';

-- Add any missing columns that might be needed
DO $$
BEGIN
  -- Check if active_from_round exists in participants
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'participants' AND column_name = 'active_from_round') THEN
    ALTER TABLE public.participants ADD COLUMN active_from_round INTEGER;
  END IF;
END $$;