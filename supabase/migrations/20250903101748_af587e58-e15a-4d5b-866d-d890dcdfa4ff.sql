-- Fix stage transition automation to continue indefinitely
-- Remove overly restrictive conditions that stop automation after ties or no votes

CREATE OR REPLACE FUNCTION public.advance_phase_atomic_v2(p_round_id uuid, p_table_id uuid, p_client_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_round_status text;
  v_round_number integer;
  v_suggestion_count integer;
  v_vote_count integer;
  v_default_suggest_sec integer;
  v_default_vote_sec integer;
  v_winner_suggestion_id uuid;
  v_winner_text text;
  v_is_tie boolean := false;
  v_max_votes integer;
  v_new_round_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_table_id::text));
  
  SELECT r.status, r.number, t.default_suggest_sec, t.default_vote_sec
  INTO v_round_status, v_round_number, v_default_suggest_sec, v_default_vote_sec
  FROM rounds r
  JOIN tables t ON t.id = r.table_id
  WHERE r.id = p_round_id AND r.table_id = p_table_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Round not found');
  END IF;
  
  SELECT COUNT(*) INTO v_suggestion_count FROM suggestions WHERE round_id = p_round_id;
  SELECT COUNT(*) INTO v_vote_count FROM votes WHERE round_id = p_round_id;
  
  IF v_round_status = 'suggest' THEN
    IF v_suggestion_count > 0 THEN
      UPDATE rounds 
      SET status = 'vote', ends_at = NOW() + MAKE_INTERVAL(secs => v_default_vote_sec)
      WHERE id = p_round_id;
      
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'moved_to_vote', 'suggestion_count', v_suggestion_count);
    ELSE
      UPDATE rounds SET status = 'result', ends_at = null WHERE id = p_round_id;
      
      INSERT INTO blocks (table_id, round_id, text, is_tie_break)
      VALUES (p_table_id, p_round_id, 'No suggestions submitted', false)
      ON CONFLICT (table_id, round_id) DO NOTHING;
      
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'ended_no_suggestions');
    END IF;
  END IF;
  
  IF v_round_status = 'vote' THEN
    IF v_vote_count = 0 THEN
      UPDATE rounds SET status = 'result', ends_at = null WHERE id = p_round_id;
      
      INSERT INTO blocks (table_id, round_id, text, is_tie_break)
      VALUES (p_table_id, p_round_id, 'No votes cast', false)
      ON CONFLICT (table_id, round_id) DO NOTHING;
      
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      -- ALWAYS auto-advance even with no votes
      INSERT INTO rounds (table_id, number, status, started_at, ends_at)
      VALUES (p_table_id, v_round_number + 1, 'suggest', NOW(), NOW() + MAKE_INTERVAL(secs => v_default_suggest_sec))
      RETURNING id INTO v_new_round_id;
      
      UPDATE tables 
      SET current_round_id = v_new_round_id, updated_at = NOW() 
      WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'ended_no_votes_and_advanced', 'new_round_id', v_new_round_id);
    END IF;
    
    WITH vote_counts AS (
      SELECT s.id as suggestion_id, s.text, s.created_at, COALESCE(COUNT(v.id), 0) as vote_count
      FROM suggestions s
      LEFT JOIN votes v ON v.suggestion_id = s.id AND v.round_id = p_round_id
      WHERE s.round_id = p_round_id
      GROUP BY s.id, s.text, s.created_at
    ),
    max_votes AS (
      SELECT MAX(vote_count) as max_count FROM vote_counts
    ),
    potential_winners AS (
      SELECT vc.suggestion_id, vc.text, vc.vote_count, vc.created_at
      FROM vote_counts vc
      JOIN max_votes mv ON vc.vote_count = mv.max_count
      ORDER BY vc.vote_count DESC, vc.created_at ASC
      LIMIT 5
    )
    SELECT pw.suggestion_id, pw.text, (SELECT COUNT(*) FROM potential_winners) > 1, pw.vote_count
    INTO v_winner_suggestion_id, v_winner_text, v_is_tie, v_max_votes
    FROM potential_winners pw
    LIMIT 1;
    
    IF v_winner_suggestion_id IS NULL OR v_winner_text IS NULL THEN
      SELECT s.id, s.text, 0
      INTO v_winner_suggestion_id, v_winner_text, v_max_votes
      FROM suggestions s
      WHERE s.round_id = p_round_id
      ORDER BY s.created_at ASC
      LIMIT 1;
      
      IF v_winner_text IS NULL THEN
        v_winner_text := 'No valid suggestions found';
        v_winner_suggestion_id := NULL;
      END IF;
      
      v_is_tie := false;
    END IF;
    
    UPDATE rounds 
    SET status = 'result', winner_suggestion_id = v_winner_suggestion_id, ends_at = null
    WHERE id = p_round_id;
    
    INSERT INTO blocks (table_id, round_id, suggestion_id, text, is_tie_break)
    VALUES (p_table_id, p_round_id, v_winner_suggestion_id, v_winner_text, v_is_tie)
    ON CONFLICT (table_id, round_id) DO UPDATE SET
      suggestion_id = EXCLUDED.suggestion_id,
      text = EXCLUDED.text,
      is_tie_break = EXCLUDED.is_tie_break;
    
    -- ALWAYS auto-advance regardless of ties or vote counts (simplified condition)
    IF v_winner_text IS NOT NULL THEN
      INSERT INTO rounds (table_id, number, status, started_at, ends_at)
      VALUES (p_table_id, v_round_number + 1, 'suggest', NOW(), NOW() + MAKE_INTERVAL(secs => v_default_suggest_sec))
      RETURNING id INTO v_new_round_id;
      
      UPDATE tables 
      SET current_round_id = v_new_round_id, updated_at = NOW() 
      WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'completed_and_advanced', 'winner', v_winner_text, 'is_tie', v_is_tie, 'vote_count', v_max_votes, 'new_round_id', v_new_round_id);
    ELSE
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'completed_round', 'winner', v_winner_text, 'is_tie', v_is_tie, 'vote_count', v_max_votes);
    END IF;
  END IF;
  
  RETURN json_build_object('success', false, 'error', 'Invalid round status: ' || v_round_status);
END $function$;