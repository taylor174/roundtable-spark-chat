-- Run the comprehensive cleanup to fix stuck tables
DO $$
DECLARE
  result json;
BEGIN
  -- Call the cleanup function
  SELECT public.comprehensive_cleanup_stuck_tables() INTO result;
  
  -- Log the result
  RAISE NOTICE 'Cleanup result: %', result;
END $$;