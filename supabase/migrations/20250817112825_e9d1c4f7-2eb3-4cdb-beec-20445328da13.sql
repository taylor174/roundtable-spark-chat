-- Drop the old 3-parameter version of start_table_session to resolve function overloading conflict
DROP FUNCTION IF EXISTS public.start_table_session(uuid, integer, integer);

-- Ensure we only have the atomic 1-parameter version
-- This function should already exist from our previous migration, but let's make sure it's correct
CREATE OR REPLACE FUNCTION public.start_table_session(p_table_id uuid)
RETURNS TABLE (round_id uuid, ends_at timestamptz) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suggest int;
  v_round_id uuid;
  v_table_status text;
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

  -- Create new round
  INSERT INTO public.rounds (table_id, number, status, started_at, ends_at)
  VALUES (
    p_table_id,
    COALESCE((SELECT MAX(number) FROM public.rounds WHERE table_id = p_table_id), 0) + 1,
    'suggest',
    NOW(),
    NOW() + MAKE_INTERVAL(secs => v_suggest)
  )
  RETURNING id INTO v_round_id;

  -- Update table to running status
  UPDATE public.tables
  SET status = 'running',
      current_round_id = v_round_id,
      updated_at = NOW()
  WHERE id = p_table_id;

  -- Return results
  RETURN QUERY
  SELECT v_round_id, NOW() + MAKE_INTERVAL(secs => v_suggest);
END $$;