-- Fix function search path security issue by setting search_path
CREATE OR REPLACE FUNCTION public.start_table_session(
  p_table_id UUID,
  p_suggest_sec INTEGER DEFAULT 300,
  p_vote_sec INTEGER DEFAULT 60
)
RETURNS TABLE(round_id UUID, table_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id UUID;
  v_ends_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate end time for suggestion phase
  v_ends_at := NOW() + (p_suggest_sec || ' seconds')::INTERVAL;
  
  -- Create first round with suggestion phase
  INSERT INTO public.rounds (
    table_id,
    number,
    status,
    started_at,
    ends_at
  ) VALUES (
    p_table_id,
    1,
    'suggestions',
    NOW(),
    v_ends_at
  )
  RETURNING id INTO v_round_id;
  
  -- Update table status and current round
  UPDATE public.tables SET
    status = 'running',
    current_round_id = v_round_id,
    default_suggest_sec = p_suggest_sec,
    default_vote_sec = p_vote_sec,
    updated_at = NOW()
  WHERE id = p_table_id;
  
  -- Return the results
  RETURN QUERY SELECT v_round_id, 'running'::TEXT;
END;
$$;

-- Fix the other function search path issues
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  RETURN new;
END;
$function$;