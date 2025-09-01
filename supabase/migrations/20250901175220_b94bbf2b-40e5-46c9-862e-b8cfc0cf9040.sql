-- Fix stuck voting rounds by forcing them to result phase
UPDATE rounds 
SET status = 'result', 
    ends_at = null
WHERE status = 'vote' 
  AND ends_at < NOW()
  AND status != 'result';

-- Update table phase_ends_at to sync with current round
UPDATE tables t
SET phase_ends_at = r.ends_at,
    updated_at = NOW()
FROM rounds r 
WHERE t.current_round_id = r.id 
  AND r.status IN ('suggest', 'vote')
  AND r.ends_at IS NOT NULL;