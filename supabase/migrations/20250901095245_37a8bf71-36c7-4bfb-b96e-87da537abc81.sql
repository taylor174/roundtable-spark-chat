
-- 1) Add a column to control when a participant becomes active
ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS active_from_round integer;

-- 2) Update suggestions INSERT policy to prevent pending participants from submitting
DROP POLICY IF EXISTS "Participants can create suggestions" ON public.suggestions;

CREATE POLICY "Participants can create suggestions"
ON public.suggestions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.participants p
    JOIN public.rounds r ON r.id = suggestions.round_id
    WHERE p.table_id = r.table_id
      AND p.id = suggestions.participant_id
      AND (p.active_from_round IS NULL OR r.number >= p.active_from_round)
  )
);

-- 3) Update votes INSERT policy to prevent pending participants from voting
DROP POLICY IF EXISTS "Participants can vote" ON public.votes;

CREATE POLICY "Participants can vote"
ON public.votes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.participants p
    JOIN public.rounds r ON r.id = votes.round_id
    WHERE p.table_id = r.table_id
      AND p.id = votes.participant_id
      AND (p.active_from_round IS NULL OR r.number >= p.active_from_round)
  )
);
