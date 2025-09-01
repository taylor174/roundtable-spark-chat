-- Create function to update participant presence
CREATE OR REPLACE FUNCTION public.update_participant_presence(p_table_id uuid, p_client_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.participants
  SET last_seen_at = NOW(),
      is_online = true
  WHERE table_id = p_table_id AND client_id = p_client_id;
END;
$function$