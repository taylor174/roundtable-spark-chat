-- Create atomic function for starting a table
CREATE OR REPLACE FUNCTION public.start_table_session(
  p_table_id UUID,
  p_suggest_sec INTEGER DEFAULT 300,
  p_vote_sec INTEGER DEFAULT 60
)
RETURNS TABLE(round_id UUID, table_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round_id UUID;
  v_ends_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate end time for suggestion phase
  v_ends_at := NOW() + (p_suggest_sec || ' seconds')::INTERVAL;
  
  -- Create first round with suggestion phase
  INSERT INTO public.rounds (
    table_id,
    number,
    status,
    started_at,
    ends_at
  ) VALUES (
    p_table_id,
    1,
    'suggestions',
    NOW(),
    v_ends_at
  )
  RETURNING id INTO v_round_id;
  
  -- Update table status and current round
  UPDATE public.tables SET
    status = 'running',
    current_round_id = v_round_id,
    default_suggest_sec = p_suggest_sec,
    default_vote_sec = p_vote_sec,
    updated_at = NOW()
  WHERE id = p_table_id;
  
  -- Return the results
  RETURN QUERY SELECT v_round_id, 'running'::TEXT;
END;
$$;

-- Ensure realtime is enabled for all necessary tables
ALTER TABLE public.tables REPLICA IDENTITY FULL;
ALTER TABLE public.rounds REPLICA IDENTITY FULL;
ALTER TABLE public.participants REPLICA IDENTITY FULL;
ALTER TABLE public.suggestions REPLICA IDENTITY FULL;
ALTER TABLE public.votes REPLICA IDENTITY FULL;
ALTER TABLE public.blocks REPLICA IDENTITY FULL;