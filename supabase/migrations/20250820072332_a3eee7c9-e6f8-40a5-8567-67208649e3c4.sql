-- Add presence tracking columns to participants table
ALTER TABLE public.participants 
ADD COLUMN last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN is_online BOOLEAN DEFAULT true;

-- Create index for efficient online status queries
CREATE INDEX idx_participants_online_status ON public.participants(table_id, is_online);

-- Create function to update last_seen_at
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

-- Create function to mark participant as offline
CREATE OR REPLACE FUNCTION public.mark_participant_offline(p_participant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.participants
  SET is_online = false
  WHERE id = p_participant_id;
END;
$function$

-- Create function to cleanup inactive participants (offline for more than 5 minutes)
CREATE OR REPLACE FUNCTION public.cleanup_inactive_participants()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.participants
  SET is_online = false
  WHERE is_online = true 
    AND last_seen_at < NOW() - INTERVAL '5 minutes';
END;
$function$