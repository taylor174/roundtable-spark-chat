-- Create function to trigger email summary when table is closed
CREATE OR REPLACE FUNCTION public.send_discussion_summary_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger when status changes to 'closed'
  IF NEW.status = 'closed' AND (OLD.status IS NULL OR OLD.status != 'closed') THEN
    -- Call the edge function asynchronously
    PERFORM net.http_post(
      url := concat(current_setting('app.settings.supabase_url'), '/functions/v1/send-discussion-summary'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', concat('Bearer ', current_setting('app.settings.service_role_key'))
      ),
      body := jsonb_build_object('table_id', NEW.id::text)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on tables to send email when discussion closes
DROP TRIGGER IF EXISTS trigger_send_summary_email ON public.tables;
CREATE TRIGGER trigger_send_summary_email
  AFTER UPDATE ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.send_discussion_summary_email();