-- Fix the start_table_session function to properly set ends_at timestamps
CREATE OR REPLACE FUNCTION public.start_table_session(p_table_id uuid)
 RETURNS TABLE(round_id uuid, ends_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_suggest int;
  v_round_id uuid;
  v_table_status text;
  v_calculated_ends_at timestamp with time zone;
BEGIN
  -- Lock the table row and get current status
  UPDATE public.tables t
  SET updated_at = now()
  WHERE t.id = p_table_id
  RETURNING t.default_suggest_sec, t.status INTO v_suggest, v_table_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table not found';
  END IF;

  -- Prevent double-starts
  IF v_table_status = 'running' THEN
    RAISE EXCEPTION 'Table is already running';
  END IF;

  -- Calculate proper end time with minimum 30 seconds
  v_calculated_ends_at := NOW() + MAKE_INTERVAL(secs => GREATEST(v_suggest, 30));

  -- Create new round with proper timestamp
  INSERT INTO public.rounds (table_id, number, status, started_at, ends_at)
  VALUES (
    p_table_id,
    COALESCE((SELECT MAX(number) FROM public.rounds WHERE table_id = p_table_id), 0) + 1,
    'suggest',
    NOW(),
    v_calculated_ends_at
  )
  RETURNING id INTO v_round_id;

  -- Update table to running status
  UPDATE public.tables
  SET status = 'running',
      current_round_id = v_round_id,
      phase_ends_at = v_calculated_ends_at,
      updated_at = NOW()
  WHERE id = p_table_id;

  -- Return results with guaranteed future timestamp
  RETURN QUERY
  SELECT v_round_id, v_calculated_ends_at;
END $function$;

-- Fix advance_phase_atomic_v2 to prevent immediate advancement
CREATE OR REPLACE FUNCTION public.advance_phase_atomic_v2(p_round_id uuid, p_table_id uuid, p_client_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_round_status text;
  v_round_number integer;
  v_round_started_at timestamp with time zone;
  v_round_ends_at timestamp with time zone;
  v_suggestion_count integer;
  v_vote_count integer;
  v_participant_count integer;
  v_default_suggest_sec integer;
  v_default_vote_sec integer;
  v_winner_suggestion_id uuid;
  v_winner_text text;
  v_is_tie boolean := false;
  v_max_votes integer;
  v_new_round_id uuid;
  v_min_phase_duration interval := INTERVAL '10 seconds';
BEGIN
  -- Lock table and round for atomic operation
  PERFORM pg_advisory_xact_lock(hashtext(p_table_id::text));
  
  -- Get current state with lock
  SELECT r.status, r.number, r.started_at, r.ends_at, t.default_suggest_sec, t.default_vote_sec
  INTO v_round_status, v_round_number, v_round_started_at, v_round_ends_at, v_default_suggest_sec, v_default_vote_sec
  FROM rounds r
  JOIN tables t ON t.id = r.table_id
  WHERE r.id = p_round_id AND r.table_id = p_table_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Round not found');
  END IF;
  
  -- Prevent advancement if round just started (less than minimum duration)
  IF v_round_started_at IS NOT NULL AND 
     v_round_started_at + v_min_phase_duration > NOW() THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Round too young to advance',
      'started_at', v_round_started_at,
      'min_duration', v_min_phase_duration
    );
  END IF;
  
  -- Only advance if time has actually expired (with 5 second buffer)
  IF v_round_ends_at IS NOT NULL AND v_round_ends_at > (NOW() - INTERVAL '5 seconds') THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Round time has not expired yet',
      'ends_at', v_round_ends_at,
      'current_time', NOW()
    );
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
      -- Move to vote phase with proper timestamp
      UPDATE rounds 
      SET status = 'vote',
          ends_at = NOW() + MAKE_INTERVAL(secs => GREATEST(v_default_vote_sec, 30))
      WHERE id = p_round_id;
      
      -- Update table phase_ends_at
      UPDATE tables 
      SET phase_ends_at = NOW() + MAKE_INTERVAL(secs => GREATEST(v_default_vote_sec, 30)),
          updated_at = NOW() 
      WHERE id = p_table_id;
      
      RETURN json_build_object(
        'success', true, 
        'action', 'moved_to_vote',
        'suggestion_count', v_suggestion_count,
        'new_ends_at', NOW() + MAKE_INTERVAL(secs => GREATEST(v_default_vote_sec, 30))
      );
    ELSE
      -- No suggestions, end round
      UPDATE rounds 
      SET status = 'result', ends_at = null
      WHERE id = p_round_id;
      
      INSERT INTO blocks (table_id, round_id, text, is_tie_break)
      VALUES (p_table_id, p_round_id, 'No suggestions submitted', false)
      ON CONFLICT (table_id, round_id) DO NOTHING;
      
      UPDATE tables SET phase_ends_at = null, updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object(
        'success', true, 
        'action', 'ended_no_suggestions'
      );
    END IF;
  END IF;
  
  -- Handle vote phase with improved winner selection
  IF v_round_status = 'vote' THEN
    -- First check if there are any votes at all
    IF v_vote_count = 0 THEN
      -- No votes case - end round with appropriate message
      UPDATE rounds 
      SET status = 'result', 
          ends_at = null
      WHERE id = p_round_id;
      
      INSERT INTO blocks (table_id, round_id, text, is_tie_break)
      VALUES (p_table_id, p_round_id, 'No votes cast', false)
      ON CONFLICT (table_id, round_id) DO NOTHING;
      
      UPDATE tables SET phase_ends_at = null, updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object(
        'success', true, 
        'action', 'ended_no_votes'
      );
    END IF;
    
    -- Robust winner determination with proper tie handling
    WITH vote_counts AS (
      SELECT 
        s.id as suggestion_id, 
        s.text,
        s.created_at,
        COALESCE(COUNT(v.id), 0) as vote_count
      FROM suggestions s
      LEFT JOIN votes v ON v.suggestion_id = s.id AND v.round_id = p_round_id
      WHERE s.round_id = p_round_id
      GROUP BY s.id, s.text, s.created_at
    ),
    max_votes AS (
      SELECT MAX(vote_count) as max_count
      FROM vote_counts
    ),
    potential_winners AS (
      SELECT vc.suggestion_id, vc.text, vc.vote_count, vc.created_at
      FROM vote_counts vc
      JOIN max_votes mv ON vc.vote_count = mv.max_count
      ORDER BY vc.vote_count DESC, vc.created_at ASC
      LIMIT 5  -- Safety limit
    )
    SELECT 
      pw.suggestion_id, 
      pw.text, 
      (SELECT COUNT(*) FROM potential_winners) > 1,
      pw.vote_count
    INTO v_winner_suggestion_id, v_winner_text, v_is_tie, v_max_votes
    FROM potential_winners pw
    LIMIT 1;
    
    -- Ensure we have valid winner data
    IF v_winner_suggestion_id IS NULL OR v_winner_text IS NULL THEN
      -- Fallback: get first suggestion if no proper winner found
      SELECT s.id, s.text, 0
      INTO v_winner_suggestion_id, v_winner_text, v_max_votes
      FROM suggestions s
      WHERE s.round_id = p_round_id
      ORDER BY s.created_at ASC
      LIMIT 1;
      
      -- If still no suggestion found, create a fallback
      IF v_winner_text IS NULL THEN
        v_winner_text := 'No valid suggestions found';
        v_winner_suggestion_id := NULL;
      END IF;
      
      v_is_tie := false;
    END IF;
    
    -- Update round to result
    UPDATE rounds 
    SET status = 'result', 
        winner_suggestion_id = v_winner_suggestion_id,
        ends_at = null
    WHERE id = p_round_id;
    
    -- Create block entry with guaranteed valid text
    INSERT INTO blocks (table_id, round_id, suggestion_id, text, is_tie_break)
    VALUES (p_table_id, p_round_id, v_winner_suggestion_id, v_winner_text, v_is_tie)
    ON CONFLICT (table_id, round_id) DO UPDATE SET
      suggestion_id = EXCLUDED.suggestion_id,
      text = EXCLUDED.text,
      is_tie_break = EXCLUDED.is_tie_break;
    
    -- Clear phase_ends_at for result phase
    UPDATE tables SET phase_ends_at = null, updated_at = NOW() WHERE id = p_table_id;
    
    RETURN json_build_object(
      'success', true, 
      'action', 'completed_round',
      'winner', v_winner_text,
      'is_tie', v_is_tie,
      'vote_count', v_max_votes
    );
  END IF;
  
  RETURN json_build_object('success', false, 'error', 'Invalid round status: ' || v_round_status);
END $function$;