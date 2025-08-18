-- Fix 1: Add better constraints and indexes for data integrity
-- Add unique constraint for table codes to prevent duplicates
ALTER TABLE public.tables ADD CONSTRAINT tables_code_unique UNIQUE (code);

-- Add composite unique index for blocks (one block per round)
CREATE UNIQUE INDEX IF NOT EXISTS blocks_one_per_round ON public.blocks (table_id, round_id);

-- Fix 2: Create cleanup function for stale rounds
CREATE OR REPLACE FUNCTION public.cleanup_stale_rounds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stale_round RECORD;
BEGIN
  -- Find rounds that are stuck in suggest/vote phase for more than 30 minutes
  FOR stale_round IN 
    SELECT r.id, r.table_id, r.status, r.ends_at
    FROM public.rounds r
    JOIN public.tables t ON r.table_id = t.id
    WHERE r.status IN ('suggest', 'vote')
      AND r.ends_at IS NOT NULL
      AND r.ends_at < NOW() - INTERVAL '30 minutes'
      AND t.status = 'running'
  LOOP
    -- Force round to result phase
    UPDATE public.rounds
    SET status = 'result',
        ends_at = null
    WHERE id = stale_round.id;
    
    -- Create a "timeout" block
    INSERT INTO public.blocks (table_id, round_id, text, suggestion_id, is_tie_break)
    VALUES (stale_round.table_id, stale_round.id, 'Round ended due to timeout', null, false)
    ON CONFLICT (table_id, round_id) DO NOTHING;
    
    -- Trigger table update
    UPDATE public.tables
    SET updated_at = NOW()
    WHERE id = stale_round.table_id;
  END LOOP;
END $$;

-- Fix 3: Enhanced block upsert function with proper conflict resolution
CREATE OR REPLACE FUNCTION public.upsert_block_safe(
  p_table_id uuid,
  p_round_id uuid,
  p_suggestion_id uuid,
  p_text text,
  p_is_tie_break boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_block RECORD;
BEGIN
  -- Check if block exists for this round
  SELECT * INTO v_existing_block
  FROM public.blocks
  WHERE table_id = p_table_id AND round_id = p_round_id;
  
  IF FOUND THEN
    -- Update existing block
    UPDATE public.blocks
    SET suggestion_id = p_suggestion_id,
        text = p_text,
        is_tie_break = p_is_tie_break,
        created_at = NOW()
    WHERE table_id = p_table_id AND round_id = p_round_id;
    
    RETURN json_build_object('success', true, 'action', 'updated');
  ELSE
    -- Insert new block
    INSERT INTO public.blocks (table_id, round_id, suggestion_id, text, is_tie_break)
    VALUES (p_table_id, p_round_id, p_suggestion_id, p_text, p_is_tie_break);
    
    RETURN json_build_object('success', true, 'action', 'created');
  END IF;
EXCEPTION 
  WHEN unique_violation THEN
    -- Handle race condition - try update instead
    UPDATE public.blocks
    SET suggestion_id = p_suggestion_id,
        text = p_text,
        is_tie_break = p_is_tie_break,
        created_at = NOW()
    WHERE table_id = p_table_id AND round_id = p_round_id;
    
    RETURN json_build_object('success', true, 'action', 'updated_on_conflict');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END $$;

-- Fix 4: Create automatic cleanup job trigger
CREATE OR REPLACE FUNCTION public.schedule_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- This would normally schedule a background job
  -- For now, we'll just log that cleanup should run
  PERFORM public.cleanup_stale_rounds();
  RETURN NEW;
END $$;

-- Create trigger to run cleanup when tables are updated
DROP TRIGGER IF EXISTS trigger_schedule_cleanup ON public.tables;
CREATE TRIGGER trigger_schedule_cleanup
  AFTER UPDATE ON public.tables
  FOR EACH ROW
  WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at)
  EXECUTE FUNCTION public.schedule_cleanup();

-- Fix 5: Add better validation for participant management
CREATE OR REPLACE FUNCTION public.validate_participant_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  participant_count integer;
BEGIN
  -- Count current participants for the table
  SELECT COUNT(*) INTO participant_count
  FROM public.participants
  WHERE table_id = NEW.table_id;
  
  -- Limit to 50 participants per table
  IF participant_count >= 50 THEN
    RAISE EXCEPTION 'Table is full (maximum 50 participants)';
  END IF;
  
  RETURN NEW;
END $$;

-- Create trigger for participant validation
DROP TRIGGER IF EXISTS trigger_validate_participant_limits ON public.participants;
CREATE TRIGGER trigger_validate_participant_limits
  BEFORE INSERT ON public.participants
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_participant_limits();