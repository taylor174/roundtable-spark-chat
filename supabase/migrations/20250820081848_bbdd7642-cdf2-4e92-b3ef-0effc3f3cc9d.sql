-- Create function to mark participant as offline
CREATE OR REPLACE FUNCTION public.mark_participant_offline(p_participant_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.participants
  SET is_online = false,
      last_seen_at = NOW()
  WHERE client_id = p_participant_id;
END;
$function$