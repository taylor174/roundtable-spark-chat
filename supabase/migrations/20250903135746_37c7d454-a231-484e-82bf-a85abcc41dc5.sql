-- Create comprehensive cleanup function to handle stuck tables and rounds
CREATE OR REPLACE FUNCTION public.comprehensive_cleanup_stuck_tables()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_updated_tables integer := 0;
  v_updated_rounds integer := 0;
  v_created_blocks integer := 0;
BEGIN
  -- Fix tables that are stuck in "running" status with no active rounds
  WITH stuck_tables AS (
    SELECT t.id, t.code, t.current_round_id
    FROM tables t
    LEFT JOIN rounds r ON t.current_round_id = r.id
    WHERE t.status = 'running'
      AND (
        r.id IS NULL OR -- No round exists
        r.status = 'result' OR -- Round already completed
        (r.ends_at IS NOT NULL AND r.ends_at < NOW() - INTERVAL '1 hour') -- Round expired over an hour ago
      )
  )
  UPDATE tables 
  SET status = 'closed', 
      current_round_id = NULL,
      phase_ends_at = NULL,
      updated_at = NOW()
  FROM stuck_tables st
  WHERE tables.id = st.id;
  
  GET DIAGNOSTICS v_updated_tables = ROW_COUNT;
  
  -- Force expired rounds to result status
  UPDATE rounds 
  SET status = 'result',
      ends_at = NULL,
      updated_at = NOW()
  WHERE status IN ('suggest', 'vote')
    AND ends_at IS NOT NULL
    AND ends_at < NOW() - INTERVAL '30 minutes';
    
  GET DIAGNOSTICS v_updated_rounds = ROW_COUNT;
  
  -- Create timeout blocks for rounds that don't have blocks but are completed
  WITH rounds_without_blocks AS (
    SELECT r.id as round_id, r.table_id, r.number
    FROM rounds r
    LEFT JOIN blocks b ON r.id = b.round_id
    WHERE r.status = 'result'
      AND b.id IS NULL
  )
  INSERT INTO blocks (table_id, round_id, text, is_tie_break, created_at)
  SELECT rwb.table_id, rwb.round_id, 
         'Round ' || rwb.number || ' ended (cleanup)', 
         false,
         NOW()
  FROM rounds_without_blocks rwb;
  
  GET DIAGNOSTICS v_created_blocks = ROW_COUNT;
  
  -- Clean up any remaining inconsistencies
  UPDATE tables 
  SET phase_ends_at = NULL,
      updated_at = NOW()
  WHERE phase_ends_at IS NOT NULL
    AND status != 'running';
  
  RETURN json_build_object(
    'success', true,
    'updated_tables', v_updated_tables,
    'updated_rounds', v_updated_rounds,
    'created_blocks', v_created_blocks,
    'message', 'Comprehensive cleanup completed successfully'
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'updated_tables', v_updated_tables,
      'updated_rounds', v_updated_rounds,
      'created_blocks', v_created_blocks
    );
END;
$$;