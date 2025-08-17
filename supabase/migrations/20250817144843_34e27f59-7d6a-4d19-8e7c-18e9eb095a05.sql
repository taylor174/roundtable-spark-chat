-- Update resolve_tie function to mark blocks as tie-breaks
CREATE OR REPLACE FUNCTION public.resolve_tie(p_table_id uuid, p_round_id uuid, p_suggestion_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_suggestion_text text;
BEGIN
  -- Get suggestion text
  SELECT text INTO v_suggestion_text
  FROM suggestions 
  WHERE id = p_suggestion_id AND round_id = p_round_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Suggestion not found';
  END IF;
  
  -- Update round to result phase with winner
  UPDATE rounds 
  SET status = 'result',
      winner_suggestion_id = p_suggestion_id,
      ends_at = null
  WHERE id = p_round_id AND table_id = p_table_id;
  
  -- Insert/update block entry (upsert) with tie-break flag
  INSERT INTO blocks (table_id, round_id, suggestion_id, text, is_tie_break, created_at)
  VALUES (p_table_id, p_round_id, p_suggestion_id, v_suggestion_text, true, now())
  ON CONFLICT (table_id, round_id) 
  DO UPDATE SET 
    suggestion_id = excluded.suggestion_id,
    text = excluded.text,
    is_tie_break = excluded.is_tie_break,
    created_at = excluded.created_at;
END $function$;