-- Remove the problematic trigger that causes table ending to fail
DROP TRIGGER IF EXISTS trigger_send_summary_email ON public.tables;

-- Remove the function that uses unavailable net.http_post()
DROP FUNCTION IF EXISTS public.send_discussion_summary_email();