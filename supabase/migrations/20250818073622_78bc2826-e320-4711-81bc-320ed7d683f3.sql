-- Create function to validate and submit votes with round checking
CREATE OR REPLACE FUNCTION public.submit_vote_with_validation(
  p_round_id uuid,
  p_participant_id uuid,
  p_suggestion_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_round_status text;
  v_round_ends_at timestamp with time zone;
  v_suggestion_exists boolean;
  v_user_already_voted boolean;
BEGIN
  -- Check if round exists and is in vote phase
  SELECT status, ends_at INTO v_round_status, v_round_ends_at
  FROM public.rounds
  WHERE id = p_round_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Round not found');
  END IF;
  
  -- Check if voting is still open
  IF v_round_status != 'vote' THEN
    RETURN json_build_object('success', false, 'error', 'Voting is not open for this round');
  END IF;
  
  -- Check if voting time has expired
  IF v_round_ends_at IS NOT NULL AND v_round_ends_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Voting has closed');
  END IF;
  
  -- Check if suggestion exists and belongs to this round
  SELECT EXISTS(
    SELECT 1 FROM public.suggestions 
    WHERE id = p_suggestion_id AND round_id = p_round_id
  ) INTO v_suggestion_exists;
  
  IF NOT v_suggestion_exists THEN
    RETURN json_build_object('success', false, 'error', 'Invalid suggestion for this round');
  END IF;
  
  -- Check if user has already voted in this round
  SELECT EXISTS(
    SELECT 1 FROM public.votes 
    WHERE round_id = p_round_id AND participant_id = p_participant_id
  ) INTO v_user_already_voted;
  
  IF v_user_already_voted THEN
    RETURN json_build_object('success', false, 'error', 'You have already voted in this round');
  END IF;
  
  -- All validations passed, insert the vote
  INSERT INTO public.votes (round_id, participant_id, suggestion_id)
  VALUES (p_round_id, p_participant_id, p_suggestion_id);
  
  RETURN json_build_object('success', true, 'message', 'Vote submitted successfully');
END $$;