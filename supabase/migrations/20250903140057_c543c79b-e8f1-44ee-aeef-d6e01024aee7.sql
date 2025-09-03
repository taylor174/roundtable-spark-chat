-- Create automated cleanup schedule using pg_cron
-- First check if pg_cron extension is enabled
SELECT cron.schedule(
  'cleanup-stuck-tables-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT public.comprehensive_cleanup_stuck_tables();
  $$
);