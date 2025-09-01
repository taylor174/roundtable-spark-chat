-- Create a simple cleanup function to force stuck rounds to result phase
CREATE OR REPLACE FUNCTION force_cleanup_expired_rounds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Force expired suggestion/vote rounds to result phase
  UPDATE rounds 
  SET status = 'result', 
      ends_at = null,
      updated_at = NOW()
  WHERE status IN ('suggest', 'vote') 
    AND ends_at < NOW()
    AND status != 'result';

  -- Clear phase_ends_at for tables with expired rounds
  UPDATE tables 
  SET phase_ends_at = null,
      updated_at = NOW()
  WHERE id IN (
    SELECT t.id FROM tables t
    JOIN rounds r ON t.current_round_id = r.id
    WHERE r.status = 'result' AND t.phase_ends_at IS NOT NULL
  );
END;
$$;