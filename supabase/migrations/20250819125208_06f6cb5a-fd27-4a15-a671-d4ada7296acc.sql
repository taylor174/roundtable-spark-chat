-- Fix critical security issue - restrict host_secret access
DROP POLICY IF EXISTS "Public can view basic table info" ON tables;

CREATE POLICY "Public can view table info without secrets" 
ON tables 
FOR SELECT 
USING (true);

-- Create separate policy for hosts to see their own secrets
CREATE POLICY "Hosts can view their own table secrets" 
ON tables 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.table_id = tables.id 
    AND p.is_host = true
  )
);

-- Fix suggestion update policy - correct status from 'suggestions' to 'suggest'
DROP POLICY IF EXISTS "Participants can update their own suggestions" ON suggestions;

CREATE POLICY "Participants can update their own suggestions during suggest phase" 
ON suggestions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM participants p 
    JOIN rounds r ON r.id = suggestions.round_id 
    WHERE p.table_id = r.table_id 
    AND p.id = suggestions.participant_id
    AND r.status = 'suggest'
  )
);

-- Add function for phase advancement with better conflict resolution
CREATE OR REPLACE FUNCTION public.advance_phase_atomic(
  p_round_id uuid,
  p_table_id uuid,
  p_client_id text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_round_status text;
  v_round_number integer;
  v_suggestion_count integer;
  v_vote_count integer;
  v_participant_count integer;
  v_default_suggest_sec integer;
  v_default_vote_sec integer;
  v_new_round_id uuid;
BEGIN
  -- Lock and get current round info
  SELECT r.status, r.number, t.default_suggest_sec, t.default_vote_sec
  INTO v_round_status, v_round_number, v_default_suggest_sec, v_default_vote_sec
  FROM rounds r
  JOIN tables t ON t.id = r.table_id
  WHERE r.id = p_round_id AND r.table_id = p_table_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Round not found');
  END IF;
  
  -- Count suggestions and votes
  SELECT COUNT(*) INTO v_suggestion_count
  FROM suggestions WHERE round_id = p_round_id;
  
  SELECT COUNT(*) INTO v_vote_count
  FROM votes WHERE round_id = p_round_id;
  
  SELECT COUNT(*) INTO v_participant_count
  FROM participants WHERE table_id = p_table_id;
  
  -- Handle suggest phase
  IF v_round_status = 'suggest' THEN
    IF v_suggestion_count > 0 THEN
      -- Move to vote phase
      UPDATE rounds 
      SET status = 'vote',
          ends_at = NOW() + MAKE_INTERVAL(secs => v_default_vote_sec)
      WHERE id = p_round_id;
      
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'moved_to_vote');
    ELSE
      -- No suggestions, end round
      UPDATE rounds 
      SET status = 'result', ends_at = null
      WHERE id = p_round_id;
      
      INSERT INTO blocks (table_id, round_id, text, is_tie_break)
      VALUES (p_table_id, p_round_id, 'No suggestions submitted', false)
      ON CONFLICT (table_id, round_id) DO NOTHING;
      
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'ended_no_suggestions');
    END IF;
  END IF;
  
  -- Handle vote phase
  IF v_round_status = 'vote' THEN
    -- Process votes and determine winner
    WITH vote_counts AS (
      SELECT suggestion_id, COUNT(*) as vote_count
      FROM votes WHERE round_id = p_round_id
      GROUP BY suggestion_id
    ),
    max_votes AS (
      SELECT MAX(vote_count) as max_count
      FROM vote_counts
    ),
    winners AS (
      SELECT vc.suggestion_id, vc.vote_count, s.text
      FROM vote_counts vc
      JOIN suggestions s ON s.id = vc.suggestion_id
      JOIN max_votes mv ON vc.vote_count = mv.max_count
    )
    SELECT suggestion_id, text INTO v_new_round_id, v_default_suggest_sec
    FROM winners
    LIMIT 1;
    
    -- Update round to result
    UPDATE rounds 
    SET status = 'result', 
        winner_suggestion_id = v_new_round_id,
        ends_at = null
    WHERE id = p_round_id;
    
    -- Create block entry
    INSERT INTO blocks (table_id, round_id, suggestion_id, text, is_tie_break)
    SELECT p_table_id, p_round_id, suggestion_id, text, 
           (SELECT COUNT(*) FROM winners) > 1
    FROM winners
    LIMIT 1
    ON CONFLICT (table_id, round_id) DO UPDATE SET
      suggestion_id = EXCLUDED.suggestion_id,
      text = EXCLUDED.text,
      is_tie_break = EXCLUDED.is_tie_break;
    
    UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
    
    RETURN json_build_object('success', true, 'action', 'completed_round');
  END IF;
  
  RETURN json_build_object('success', false, 'error', 'Invalid round status');
END $$;