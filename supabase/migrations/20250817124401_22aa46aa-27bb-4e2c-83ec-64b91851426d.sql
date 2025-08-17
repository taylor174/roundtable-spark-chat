-- Add winner_suggestion_id column to rounds table
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS winner_suggestion_id uuid;

-- Add unique constraint to prevent duplicate blocks per round
CREATE UNIQUE INDEX IF NOT EXISTS blocks_one_per_round ON public.blocks(table_id, round_id);

-- Create atomic tie-break resolution function
CREATE OR REPLACE FUNCTION public.resolve_tie(
  p_table_id uuid,
  p_round_id uuid, 
  p_suggestion_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  
  -- Insert/update block entry (upsert)
  INSERT INTO blocks (table_id, round_id, suggestion_id, text, created_at)
  VALUES (p_table_id, p_round_id, p_suggestion_id, v_suggestion_text, now())
  ON CONFLICT (table_id, round_id) 
  DO UPDATE SET 
    suggestion_id = excluded.suggestion_id,
    text = excluded.text,
    created_at = excluded.created_at;
END $$;

-- Enable realtime for blocks table
ALTER TABLE public.blocks REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.blocks;