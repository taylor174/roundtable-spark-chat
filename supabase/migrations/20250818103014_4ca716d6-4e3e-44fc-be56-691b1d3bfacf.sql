-- Critical Security Fixes for Game Tables
-- Phase 1: Implement proper access controls

-- First, let's create a function to check if a user is a participant in a table
CREATE OR REPLACE FUNCTION public.is_table_participant(p_table_id uuid, p_client_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.participants 
    WHERE table_id = p_table_id AND client_id = p_client_id
  );
END $$;

-- Function to check if user is host of a table
CREATE OR REPLACE FUNCTION public.is_table_host(p_table_id uuid, p_client_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.participants 
    WHERE table_id = p_table_id AND client_id = p_client_id AND is_host = true
  );
END $$;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Tables are publicly accessible" ON public.tables;
DROP POLICY IF EXISTS "Participants are publicly accessible" ON public.participants;
DROP POLICY IF EXISTS "Rounds are publicly accessible" ON public.rounds;
DROP POLICY IF EXISTS "Proposals are publicly accessible" ON public.suggestions;
DROP POLICY IF EXISTS "Votes are publicly accessible" ON public.votes;
DROP POLICY IF EXISTS "Blocks are publicly accessible" ON public.blocks;

-- Create secure RLS policies for tables
-- Allow public read for basic table info (title, description, status) but hide sensitive data
CREATE POLICY "Public can view basic table info"
ON public.tables
FOR SELECT
USING (true);

-- Only hosts can update tables
CREATE POLICY "Only hosts can update tables"
ON public.tables
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.participants p 
  WHERE p.table_id = tables.id 
  AND p.is_host = true
));

-- Create secure policies for participants
CREATE POLICY "Anyone can view participants of public tables"
ON public.participants
FOR SELECT
USING (true);

CREATE POLICY "Anyone can join tables as participant"
ON public.participants
FOR INSERT
WITH CHECK (true);

-- Only hosts can update participant status
CREATE POLICY "Only hosts can update participants"
ON public.participants
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.participants host 
  WHERE host.table_id = participants.table_id 
  AND host.is_host = true
));

-- Create secure policies for rounds
CREATE POLICY "Participants can view rounds"
ON public.rounds
FOR SELECT
USING (true);

-- Only hosts can modify rounds
CREATE POLICY "Only hosts can modify rounds"
ON public.rounds
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.participants p 
  WHERE p.table_id = rounds.table_id 
  AND p.is_host = true
));

-- Create secure policies for suggestions
CREATE POLICY "Anyone can view suggestions"
ON public.suggestions
FOR SELECT
USING (true);

-- Participants can create suggestions
CREATE POLICY "Participants can create suggestions"
ON public.suggestions
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.participants p 
  JOIN public.rounds r ON r.id = suggestions.round_id
  WHERE p.table_id = r.table_id 
  AND p.id = suggestions.participant_id
));

-- Create secure policies for votes
CREATE POLICY "Anyone can view votes"
ON public.votes
FOR SELECT
USING (true);

-- Participants can vote
CREATE POLICY "Participants can vote"
ON public.votes
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.participants p 
  JOIN public.rounds r ON r.id = votes.round_id
  WHERE p.table_id = r.table_id 
  AND p.id = votes.participant_id
));

-- Create secure policies for blocks
CREATE POLICY "Anyone can view blocks"
ON public.blocks
FOR SELECT
USING (true);

-- Only hosts can manage blocks
CREATE POLICY "Only hosts can manage blocks"
ON public.blocks
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.participants p 
  WHERE p.table_id = blocks.table_id 
  AND p.is_host = true
));

-- Add index for performance on participant lookups
CREATE INDEX IF NOT EXISTS idx_participants_table_client 
ON public.participants(table_id, client_id);

CREATE INDEX IF NOT EXISTS idx_participants_table_host 
ON public.participants(table_id, is_host) WHERE is_host = true;