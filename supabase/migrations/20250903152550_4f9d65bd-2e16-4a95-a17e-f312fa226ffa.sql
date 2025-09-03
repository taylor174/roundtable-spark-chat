-- System Limits and Capacity Management Functions

-- Function to check system capacity before creating new tables
CREATE OR REPLACE FUNCTION public.check_system_capacity()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_running_tables integer;
  v_total_participants integer;
  v_result json;
BEGIN
  -- Count currently running tables
  SELECT COUNT(*) INTO v_running_tables
  FROM tables
  WHERE status = 'running';
  
  -- Count total active participants (seen in last 10 minutes)
  SELECT COUNT(*) INTO v_total_participants
  FROM participants
  WHERE last_seen_at > NOW() - INTERVAL '10 minutes';
  
  -- Build result with current usage and limits
  SELECT json_build_object(
    'can_create_table', v_running_tables < 500,
    'running_tables', v_running_tables,
    'max_tables', 500,
    'active_participants', v_total_participants,
    'max_participants', 800,
    'table_capacity_pct', ROUND((v_running_tables::numeric / 500) * 100, 1),
    'participant_capacity_pct', ROUND((v_total_participants::numeric / 800) * 100, 1),
    'at_capacity', (v_running_tables >= 500 OR v_total_participants >= 800)
  ) INTO v_result;
  
  RETURN v_result;
END $function$;

-- Function to enforce round limits
CREATE OR REPLACE FUNCTION public.enforce_rounds_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_round_count integer;
BEGIN
  -- Count existing rounds for this table
  SELECT COUNT(*) INTO v_round_count
  FROM rounds
  WHERE table_id = NEW.table_id;
  
  -- Enforce maximum 25 rounds per table
  IF v_round_count >= 25 THEN
    RAISE EXCEPTION 'Table has reached maximum of 25 rounds';
  END IF;
  
  RETURN NEW;
END $function$;

-- Function to get real-time system limits status
CREATE OR REPLACE FUNCTION public.get_system_limits_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'tables', json_build_object(
      'running', (SELECT COUNT(*) FROM tables WHERE status = 'running'),
      'total', (SELECT COUNT(*) FROM tables),
      'max_simultaneous', 500
    ),
    'participants', json_build_object(
      'active', (SELECT COUNT(*) FROM participants WHERE last_seen_at > NOW() - INTERVAL '10 minutes'),
      'total', (SELECT COUNT(*) FROM participants),
      'max_total', 800
    ),
    'rounds', json_build_object(
      'max_per_table', 25,
      'tables_at_limit', (
        SELECT COUNT(*) FROM (
          SELECT table_id
          FROM rounds
          GROUP BY table_id
          HAVING COUNT(*) >= 25
        ) AS limited_tables
      )
    ),
    'capacity_status', CASE 
      WHEN (SELECT COUNT(*) FROM tables WHERE status = 'running') >= 500 THEN 'tables_full'
      WHEN (SELECT COUNT(*) FROM participants WHERE last_seen_at > NOW() - INTERVAL '10 minutes') >= 800 THEN 'participants_full'
      WHEN (SELECT COUNT(*) FROM tables WHERE status = 'running') >= 400 THEN 'approaching_table_limit'
      WHEN (SELECT COUNT(*) FROM participants WHERE last_seen_at > NOW() - INTERVAL '10 minutes') >= 640 THEN 'approaching_participant_limit'
      ELSE 'healthy'
    END
  ) INTO v_result;
  
  RETURN v_result;
END $function$;

-- Enhanced create_table_secure function with capacity checks
CREATE OR REPLACE FUNCTION public.create_table_secure_with_limits(
  p_code text, 
  p_host_secret text, 
  p_title text, 
  p_description text, 
  p_default_suggest_sec integer, 
  p_default_vote_sec integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_table_id uuid;
  v_capacity_check json;
BEGIN
  -- Check system capacity first
  SELECT public.check_system_capacity() INTO v_capacity_check;
  
  -- Return error if at capacity
  IF NOT (v_capacity_check->>'can_create_table')::boolean THEN
    RETURN json_build_object(
      'success', false,
      'error', 'System at capacity',
      'details', v_capacity_check
    );
  END IF;
  
  -- Insert new table (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO public.tables (
    code, 
    host_secret, 
    title, 
    description, 
    default_suggest_sec, 
    default_vote_sec,
    status
  )
  VALUES (
    p_code,
    p_host_secret,
    p_title,
    p_description,
    p_default_suggest_sec,
    p_default_vote_sec,
    'lobby'
  )
  RETURNING id INTO v_table_id;
  
  -- Return success with table info
  RETURN json_build_object(
    'success', true,
    'table', json_build_object(
      'id', v_table_id,
      'code', p_code,
      'status', 'lobby'
    ),
    'capacity_status', v_capacity_check
  );
END $function$;

-- Create trigger for round limits
DROP TRIGGER IF EXISTS enforce_rounds_limit_trigger ON rounds;
CREATE TRIGGER enforce_rounds_limit_trigger
BEFORE INSERT ON rounds
FOR EACH ROW
EXECUTE FUNCTION enforce_rounds_limit();