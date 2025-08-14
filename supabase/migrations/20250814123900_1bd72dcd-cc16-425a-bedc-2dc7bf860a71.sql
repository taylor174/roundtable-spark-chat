-- Phase 1: Database Schema Migration
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- First, let's rename and restructure the tables table
ALTER TABLE public.tables 
  RENAME COLUMN host_token TO host_secret;

ALTER TABLE public.tables 
  RENAME COLUMN suggestion_seconds TO default_suggest_sec;

ALTER TABLE public.tables 
  RENAME COLUMN voting_seconds TO default_vote_sec;

-- Update status enum values
UPDATE public.tables SET status = 'lobby' WHERE status = 'waiting';
UPDATE public.tables SET status = 'running' WHERE status = 'active';
UPDATE public.tables SET status = 'closed' WHERE status = 'ended';

-- Add client_id to participants table
ALTER TABLE public.participants 
  ADD COLUMN client_id text;

-- Update existing participants with a generated client_id
UPDATE public.participants 
SET client_id = gen_random_uuid()::text 
WHERE client_id IS NULL;

-- Make client_id not null after populating
ALTER TABLE public.participants 
  ALTER COLUMN client_id SET NOT NULL;

-- Add unique constraint for table_id + client_id
ALTER TABLE public.participants 
  ADD CONSTRAINT participants_table_client_unique UNIQUE (table_id, client_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS participants_table_idx ON public.participants(table_id);

-- Update rounds table structure
ALTER TABLE public.rounds 
  RENAME COLUMN round_index TO number;

-- Update round status values and add ends_at
UPDATE public.rounds SET status = 'lobby' WHERE status = 'suggestions';
UPDATE public.rounds SET status = 'suggest' WHERE status = 'voting';
UPDATE public.rounds SET status = 'vote' WHERE status = 'results';

-- Add ends_at column to rounds
ALTER TABLE public.rounds 
  ADD COLUMN ends_at timestamptz;

-- Add unique constraint for table_id + number
ALTER TABLE public.rounds 
  ADD CONSTRAINT rounds_table_number_unique UNIQUE (table_id, number);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS rounds_table_idx ON public.rounds(table_id);

-- Rename proposals to suggestions
ALTER TABLE public.proposals 
  RENAME TO suggestions;

-- Add text length constraint
ALTER TABLE public.suggestions 
  ADD CONSTRAINT suggestions_text_length CHECK (char_length(text) <= 200);

-- Add unique constraint for one suggestion per participant per round
ALTER TABLE public.suggestions 
  ADD CONSTRAINT suggestions_round_participant_unique UNIQUE (round_id, participant_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS suggestions_round_idx ON public.suggestions(round_id);

-- Update votes table to reference suggestions instead of proposals
ALTER TABLE public.votes 
  RENAME COLUMN proposal_id TO suggestion_id;

-- Add unique constraint for one vote per participant per round
ALTER TABLE public.votes 
  ADD CONSTRAINT votes_round_participant_unique UNIQUE (round_id, participant_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS votes_round_idx ON public.votes(round_id);

-- Update blocks table to remove winning_proposal_id (now cached as text)
ALTER TABLE public.blocks 
  DROP COLUMN IF EXISTS winning_proposal_id;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS blocks_table_idx ON public.blocks(table_id);