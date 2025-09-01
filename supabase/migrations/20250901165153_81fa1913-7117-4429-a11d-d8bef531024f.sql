-- Fix foreign key constraint names to match expected frontend patterns
-- The issue is that suggestions table constraints use 'proposals_*' instead of 'suggestions_*'

-- First, drop the existing constraints with wrong names
ALTER TABLE public.suggestions 
  DROP CONSTRAINT IF EXISTS proposals_participant_id_fkey,
  DROP CONSTRAINT IF EXISTS proposals_round_id_fkey;

-- Add constraints with correct naming pattern
ALTER TABLE public.suggestions 
  ADD CONSTRAINT suggestions_participant_id_fkey 
    FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  ADD CONSTRAINT suggestions_round_id_fkey 
    FOREIGN KEY (round_id) REFERENCES public.rounds(id);

-- Fix votes table constraints to follow consistent naming
ALTER TABLE public.votes 
  DROP CONSTRAINT IF EXISTS votes_participant_id_fkey,
  DROP CONSTRAINT IF EXISTS votes_round_id_fkey,
  DROP CONSTRAINT IF EXISTS votes_suggestion_id_fkey;

ALTER TABLE public.votes 
  ADD CONSTRAINT votes_participant_id_fkey 
    FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  ADD CONSTRAINT votes_round_id_fkey 
    FOREIGN KEY (round_id) REFERENCES public.rounds(id),
  ADD CONSTRAINT votes_suggestion_id_fkey 
    FOREIGN KEY (suggestion_id) REFERENCES public.suggestions(id);

-- Fix blocks table constraints
ALTER TABLE public.blocks 
  DROP CONSTRAINT IF EXISTS blocks_table_id_fkey,
  DROP CONSTRAINT IF EXISTS blocks_round_id_fkey,
  DROP CONSTRAINT IF EXISTS blocks_suggestion_id_fkey;

ALTER TABLE public.blocks 
  ADD CONSTRAINT blocks_table_id_fkey 
    FOREIGN KEY (table_id) REFERENCES public.tables(id),
  ADD CONSTRAINT blocks_round_id_fkey 
    FOREIGN KEY (round_id) REFERENCES public.rounds(id),
  ADD CONSTRAINT blocks_suggestion_id_fkey 
    FOREIGN KEY (suggestion_id) REFERENCES public.suggestions(id);