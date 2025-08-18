-- Create atomic function for suggest→vote transition
CREATE OR REPLACE FUNCTION public.start_vote_phase_atomic(
  p_round_id uuid,
  p_table_id uuid, 
  p_ends_at timestamp with time zone
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update round to vote phase
  UPDATE public.rounds 
  SET status = 'vote',
      ends_at = p_ends_at
  WHERE id = p_round_id;
  
  -- Trigger global refresh by updating table timestamp
  UPDATE public.tables 
  SET updated_at = now()
  WHERE id = p_table_id;
END $$;