-- Remove suggestion length constraints to allow longer suggestions
ALTER TABLE public.suggestions DROP CONSTRAINT IF EXISTS proposals_text_check;
ALTER TABLE public.suggestions DROP CONSTRAINT IF EXISTS suggestions_text_length;

-- Add unique constraint for single suggestion per participant per round
CREATE UNIQUE INDEX IF NOT EXISTS unique_participant_suggestion_per_round 
ON public.suggestions(round_id, participant_id);

-- Add winner_suggestion_id to rounds table for better tie-break handling
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS winner_suggestion_id UUID REFERENCES public.suggestions(id);

-- Ensure blocks table has proper structure
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS suggestion_id UUID REFERENCES public.suggestions(id);