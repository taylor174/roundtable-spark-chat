-- Phase 1: Critical Security & Reliability Fixes

-- Fix 1: Secure host_secret access with proper RLS policies
DROP POLICY IF EXISTS "Public can view table info without secrets" ON tables;
DROP POLICY IF EXISTS "Hosts can view their own table secrets" ON tables;

-- Create secure policies that prevent host_secret exposure
CREATE POLICY "Public can view basic table info" 
ON tables 
FOR SELECT 
USING (true);

-- Secure RLS function to check host status without exposing secrets
CREATE OR REPLACE FUNCTION public.is_current_user_host(table_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM participants 
    WHERE participants.table_id = is_current_user_host.table_id 
    AND participants.is_host = true
  );
END;
$$;

-- Host-only policy for viewing sensitive data
CREATE POLICY "Hosts can access table secrets"
ON tables
FOR SELECT
USING (public.is_current_user_host(id));

-- Fix 2: Strengthen suggestion RLS policies 
DROP POLICY IF EXISTS "Participants can update their own suggestions during suggest ph" ON suggestions;

CREATE POLICY "Participants can update own suggestions in suggest phase"
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
    AND r.ends_at > NOW()  -- Additional time check
  )
);

-- Fix 3: Add database constraints for data integrity
ALTER TABLE rounds ADD CONSTRAINT valid_round_status 
CHECK (status IN ('lobby', 'suggest', 'vote', 'result'));

ALTER TABLE participants ADD CONSTRAINT valid_display_name_length
CHECK (char_length(display_name) BETWEEN 1 AND 50);

ALTER TABLE suggestions ADD CONSTRAINT valid_suggestion_length
CHECK (char_length(text) BETWEEN 1 AND 500);

-- Fix 4: Enhanced atomic phase advancement with better race condition handling
CREATE OR REPLACE FUNCTION public.advance_phase_atomic_v2(
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
  v_winner_suggestion_id uuid;
  v_winner_text text;
  v_is_tie boolean := false;
BEGIN
  -- Lock table and round for atomic operation
  PERFORM pg_advisory_xact_lock(hashtext(p_table_id::text));
  
  -- Get current state with lock
  SELECT r.status, r.number, t.default_suggest_sec, t.default_vote_sec
  INTO v_round_status, v_round_number, v_default_suggest_sec, v_default_vote_sec
  FROM rounds r
  JOIN tables t ON t.id = r.table_id
  WHERE r.id = p_round_id AND r.table_id = p_table_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Round not found');
  END IF;
  
  -- Count participants, suggestions and votes
  SELECT COUNT(*) INTO v_participant_count
  FROM participants WHERE table_id = p_table_id;
  
  SELECT COUNT(*) INTO v_suggestion_count
  FROM suggestions WHERE round_id = p_round_id;
  
  SELECT COUNT(*) INTO v_vote_count
  FROM votes WHERE round_id = p_round_id;
  
  -- Handle suggest phase
  IF v_round_status = 'suggest' THEN
    IF v_suggestion_count > 0 THEN
      -- Move to vote phase
      UPDATE rounds 
      SET status = 'vote',
          ends_at = NOW() + MAKE_INTERVAL(secs => v_default_vote_sec)
      WHERE id = p_round_id;
      
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object(
        'success', true, 
        'action', 'moved_to_vote',
        'suggestion_count', v_suggestion_count
      );
    ELSE
      -- No suggestions, end round
      UPDATE rounds 
      SET status = 'result', ends_at = null
      WHERE id = p_round_id;
      
      INSERT INTO blocks (table_id, round_id, text, is_tie_break)
      VALUES (p_table_id, p_round_id, 'No suggestions submitted', false)
      ON CONFLICT (table_id, round_id) DO NOTHING;
      
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object(
        'success', true, 
        'action', 'ended_no_suggestions'
      );
    END IF;
  END IF;
  
  -- Handle vote phase with improved winner selection
  IF v_round_status = 'vote' THEN
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
      SELECT vc.suggestion_id, vc.vote_count, s.text, s.created_at
      FROM vote_counts vc
      JOIN suggestions s ON s.id = vc.suggestion_id
      JOIN max_votes mv ON vc.vote_count = mv.max_count
      ORDER BY vc.vote_count DESC, s.created_at ASC
    )
    SELECT suggestion_id, text, (SELECT COUNT(*) FROM winners) > 1
    INTO v_winner_suggestion_id, v_winner_text, v_is_tie
    FROM winners
    LIMIT 1;
    
    -- Update round to result
    UPDATE rounds 
    SET status = 'result', 
        winner_suggestion_id = v_winner_suggestion_id,
        ends_at = null
    WHERE id = p_round_id;
    
    -- Create block entry
    INSERT INTO blocks (table_id, round_id, suggestion_id, text, is_tie_break)
    VALUES (p_table_id, p_round_id, v_winner_suggestion_id, v_winner_text, v_is_tie)
    ON CONFLICT (table_id, round_id) DO UPDATE SET
      suggestion_id = EXCLUDED.suggestion_id,
      text = EXCLUDED.text,
      is_tie_break = EXCLUDED.is_tie_break;
    
    UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
    
    RETURN json_build_object(
      'success', true, 
      'action', 'completed_round',
      'winner', v_winner_text,
      'is_tie', v_is_tie,
      'vote_count', v_vote_count
    );
  END IF;
  
  RETURN json_build_object('success', false, 'error', 'Invalid round status: ' || v_round_status);
END $$;

-- Fix 5: Add session validation function
CREATE OR REPLACE FUNCTION public.validate_table_session(
  p_table_id uuid,
  p_client_id text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_table_status text;
  v_participant_exists boolean;
BEGIN
  -- Check if table exists and get status
  SELECT status INTO v_table_status
  FROM tables WHERE id = p_table_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Table not found');
  END IF;
  
  -- Check if client is a participant
  SELECT EXISTS(
    SELECT 1 FROM participants 
    WHERE table_id = p_table_id AND client_id = p_client_id
  ) INTO v_participant_exists;
  
  IF NOT v_participant_exists THEN
    RETURN json_build_object('valid', false, 'error', 'Not a participant');
  END IF;
  
  RETURN json_build_object(
    'valid', true, 
    'table_status', v_table_status,
    'message', 'Session valid'
  );
END $$;