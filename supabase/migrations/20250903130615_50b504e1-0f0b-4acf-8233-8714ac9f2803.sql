-- Classroom Sessions Database Schema
-- Complete setup script for independent deployment

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Create tables for classroom sessions
CREATE TABLE IF NOT EXISTS public.tables (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  host_secret TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  title TEXT,
  description TEXT,
  default_suggest_sec INTEGER NOT NULL DEFAULT 120,
  default_vote_sec INTEGER NOT NULL DEFAULT 60,
  current_round_id UUID,
  phase_ends_at TIMESTAMP WITH TIME ZONE,
  auto_advance BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (code)
);

-- Create participants table
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL,
  client_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  is_online BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (table_id, client_id)
);

-- Create rounds table
CREATE TABLE IF NOT EXISTS public.rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL,
  number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggestions',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  winner_suggestion_id UUID,
  PRIMARY KEY (id)
);

-- Create suggestions table
CREATE TABLE IF NOT EXISTS public.suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  participant_id UUID NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Create votes table
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL,
  participant_id UUID NOT NULL,
  suggestion_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (round_id, participant_id)
);

-- Create blocks table for timeline
CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL,
  round_id UUID NOT NULL,
  suggestion_id UUID,
  text TEXT NOT NULL,
  is_tie_break BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (table_id, round_id)
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL,
  user_id UUID,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "tables_secure_select_policy" ON public.tables;
DROP POLICY IF EXISTS "tables_insert_policy" ON public.tables;
DROP POLICY IF EXISTS "tables_update_policy" ON public.tables;
DROP POLICY IF EXISTS "Anyone can view participants of public tables" ON public.participants;
DROP POLICY IF EXISTS "Anyone can insert participants" ON public.participants;
DROP POLICY IF EXISTS "Only hosts can update participants" ON public.participants;
DROP POLICY IF EXISTS "Participants can view rounds" ON public.rounds;
DROP POLICY IF EXISTS "Only hosts can modify rounds" ON public.rounds;
DROP POLICY IF EXISTS "Anyone can view suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Participants can create suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Participants can update own suggestions in suggest phase" ON public.suggestions;
DROP POLICY IF EXISTS "Anyone can view votes" ON public.votes;
DROP POLICY IF EXISTS "Participants can vote" ON public.votes;
DROP POLICY IF EXISTS "Anyone can view blocks" ON public.blocks;
DROP POLICY IF EXISTS "Only hosts can manage blocks" ON public.blocks;
DROP POLICY IF EXISTS "Chat messages are viewable by table participants" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated users can insert chat messages" ON public.chat_messages;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for tables
CREATE POLICY "tables_secure_select_policy" ON public.tables FOR SELECT USING (true);
CREATE POLICY "tables_insert_policy" ON public.tables FOR INSERT WITH CHECK (true);
CREATE POLICY "tables_update_policy" ON public.tables FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.table_id = tables.id AND p.is_host = true
  )
);

-- RLS Policies for participants
CREATE POLICY "Anyone can view participants of public tables" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Anyone can insert participants" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Only hosts can update participants" ON public.participants FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM participants host 
    WHERE host.table_id = participants.table_id AND host.is_host = true
  )
);

-- RLS Policies for rounds
CREATE POLICY "Participants can view rounds" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "Only hosts can modify rounds" ON public.rounds FOR ALL USING (
  EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.table_id = rounds.table_id AND p.is_host = true
  )
);

-- RLS Policies for suggestions
CREATE POLICY "Anyone can view suggestions" ON public.suggestions FOR SELECT USING (true);
CREATE POLICY "Participants can create suggestions" ON public.suggestions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM participants p 
    JOIN rounds r ON r.id = suggestions.round_id 
    WHERE p.table_id = r.table_id AND p.id = suggestions.participant_id
  )
);
CREATE POLICY "Participants can update own suggestions in suggest phase" ON public.suggestions FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM participants p 
    JOIN rounds r ON r.id = suggestions.round_id 
    WHERE p.table_id = r.table_id AND p.id = suggestions.participant_id 
    AND r.status = 'suggest' AND r.ends_at > now()
  )
);

-- RLS Policies for votes
CREATE POLICY "Anyone can view votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Participants can vote" ON public.votes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM participants p 
    JOIN rounds r ON r.id = votes.round_id 
    WHERE p.table_id = r.table_id AND p.id = votes.participant_id
  )
);

-- RLS Policies for blocks
CREATE POLICY "Anyone can view blocks" ON public.blocks FOR SELECT USING (true);
CREATE POLICY "Only hosts can manage blocks" ON public.blocks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM participants p 
    WHERE p.table_id = blocks.table_id AND p.is_host = true
  )
);

-- RLS Policies for chat_messages
CREATE POLICY "Chat messages are viewable by table participants" ON public.chat_messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert chat messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create database functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers to avoid conflicts
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_tables_updated_at ON public.tables;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tables_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Essential functions for table operations
CREATE OR REPLACE FUNCTION public.start_table_session(p_table_id uuid)
RETURNS TABLE(round_id uuid, ends_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_suggest int;
  v_round_id uuid;
  v_table_status text;
BEGIN
  UPDATE public.tables t
  SET updated_at = now()
  WHERE t.id = p_table_id
  RETURNING t.default_suggest_sec, t.status INTO v_suggest, v_table_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Table not found';
  END IF;

  IF v_table_status = 'running' THEN
    RAISE EXCEPTION 'Table is already running';
  END IF;

  INSERT INTO public.rounds (table_id, number, status, started_at, ends_at)
  VALUES (
    p_table_id,
    COALESCE((SELECT MAX(number) FROM public.rounds WHERE table_id = p_table_id), 0) + 1,
    'suggest',
    NOW(),
    NOW() + MAKE_INTERVAL(secs => v_suggest)
  )
  RETURNING id INTO v_round_id;

  UPDATE public.tables
  SET status = 'running',
      current_round_id = v_round_id,
      updated_at = NOW()
  WHERE id = p_table_id;

  RETURN QUERY
  SELECT v_round_id, NOW() + MAKE_INTERVAL(secs => v_suggest);
END $$;

CREATE OR REPLACE FUNCTION public.advance_phase_atomic_v2(p_round_id uuid, p_table_id uuid, p_client_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_round_status text;
  v_round_number integer;
  v_suggestion_count integer;
  v_vote_count integer;
  v_default_suggest_sec integer;
  v_default_vote_sec integer;
  v_winner_suggestion_id uuid;
  v_winner_text text;
  v_is_tie boolean := false;
  v_max_votes integer;
  v_new_round_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_table_id::text));
  
  SELECT r.status, r.number, t.default_suggest_sec, t.default_vote_sec
  INTO v_round_status, v_round_number, v_default_suggest_sec, v_default_vote_sec
  FROM rounds r
  JOIN tables t ON t.id = r.table_id
  WHERE r.id = p_round_id AND r.table_id = p_table_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Round not found');
  END IF;
  
  SELECT COUNT(*) INTO v_suggestion_count FROM suggestions WHERE round_id = p_round_id;
  SELECT COUNT(*) INTO v_vote_count FROM votes WHERE round_id = p_round_id;
  
  IF v_round_status = 'suggest' THEN
    IF v_suggestion_count > 0 THEN
      UPDATE rounds 
      SET status = 'vote', ends_at = NOW() + MAKE_INTERVAL(secs => v_default_vote_sec)
      WHERE id = p_round_id;
      
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'moved_to_vote', 'suggestion_count', v_suggestion_count);
    ELSE
      UPDATE rounds SET status = 'result', ends_at = null WHERE id = p_round_id;
      
      INSERT INTO blocks (table_id, round_id, text, is_tie_break)
      VALUES (p_table_id, p_round_id, 'No suggestions submitted', false)
      ON CONFLICT (table_id, round_id) DO NOTHING;
      
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'ended_no_suggestions');
    END IF;
  END IF;
  
  IF v_round_status = 'vote' THEN
    IF v_vote_count = 0 THEN
      UPDATE rounds SET status = 'result', ends_at = null WHERE id = p_round_id;
      
      INSERT INTO blocks (table_id, round_id, text, is_tie_break)
      VALUES (p_table_id, p_round_id, 'No votes cast', false)
      ON CONFLICT (table_id, round_id) DO NOTHING;
      
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'ended_no_votes');
    END IF;
    
    WITH vote_counts AS (
      SELECT s.id as suggestion_id, s.text, s.created_at, COALESCE(COUNT(v.id), 0) as vote_count
      FROM suggestions s
      LEFT JOIN votes v ON v.suggestion_id = s.id AND v.round_id = p_round_id
      WHERE s.round_id = p_round_id
      GROUP BY s.id, s.text, s.created_at
    ),
    max_votes AS (
      SELECT MAX(vote_count) as max_count FROM vote_counts
    ),
    potential_winners AS (
      SELECT vc.suggestion_id, vc.text, vc.vote_count, vc.created_at
      FROM vote_counts vc
      JOIN max_votes mv ON vc.vote_count = mv.max_count
      ORDER BY vc.vote_count DESC, vc.created_at ASC
      LIMIT 5
    )
    SELECT pw.suggestion_id, pw.text, (SELECT COUNT(*) FROM potential_winners) > 1, pw.vote_count
    INTO v_winner_suggestion_id, v_winner_text, v_is_tie, v_max_votes
    FROM potential_winners pw
    LIMIT 1;
    
    IF v_winner_suggestion_id IS NULL OR v_winner_text IS NULL THEN
      SELECT s.id, s.text, 0
      INTO v_winner_suggestion_id, v_winner_text, v_max_votes
      FROM suggestions s
      WHERE s.round_id = p_round_id
      ORDER BY s.created_at ASC
      LIMIT 1;
      
      IF v_winner_text IS NULL THEN
        v_winner_text := 'No valid suggestions found';
        v_winner_suggestion_id := NULL;
      END IF;
      
      v_is_tie := false;
    END IF;
    
    UPDATE rounds 
    SET status = 'result', winner_suggestion_id = v_winner_suggestion_id, ends_at = null
    WHERE id = p_round_id;
    
    INSERT INTO blocks (table_id, round_id, suggestion_id, text, is_tie_break)
    VALUES (p_table_id, p_round_id, v_winner_suggestion_id, v_winner_text, v_is_tie)
    ON CONFLICT (table_id, round_id) DO UPDATE SET
      suggestion_id = EXCLUDED.suggestion_id,
      text = EXCLUDED.text,
      is_tie_break = EXCLUDED.is_tie_break;
    
    IF NOT v_is_tie AND v_max_votes > 0 AND v_winner_text IS NOT NULL THEN
      INSERT INTO rounds (table_id, number, status, started_at, ends_at)
      VALUES (p_table_id, v_round_number + 1, 'suggest', NOW(), NOW() + MAKE_INTERVAL(secs => v_default_suggest_sec))
      RETURNING id INTO v_new_round_id;
      
      UPDATE tables 
      SET current_round_id = v_new_round_id, updated_at = NOW() 
      WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'completed_and_advanced', 'winner', v_winner_text, 'is_tie', v_is_tie, 'vote_count', v_max_votes, 'new_round_id', v_new_round_id);
    ELSE
      UPDATE tables SET updated_at = NOW() WHERE id = p_table_id;
      
      RETURN json_build_object('success', true, 'action', 'completed_round', 'winner', v_winner_text, 'is_tie', v_is_tie, 'vote_count', v_max_votes);
    END IF;
  END IF;
  
  RETURN json_build_object('success', false, 'error', 'Invalid round status: ' || v_round_status);
END $$;

-- Additional utility functions
CREATE OR REPLACE FUNCTION public.submit_vote_with_validation(p_round_id uuid, p_participant_id uuid, p_suggestion_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_round_status text;
  v_round_ends_at timestamp with time zone;
  v_suggestion_exists boolean;
  v_user_already_voted boolean;
BEGIN
  SELECT status, ends_at INTO v_round_status, v_round_ends_at
  FROM public.rounds WHERE id = p_round_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Round not found');
  END IF;
  
  IF v_round_status != 'vote' THEN
    RETURN json_build_object('success', false, 'error', 'Voting is not open for this round');
  END IF;
  
  IF v_round_ends_at IS NOT NULL AND v_round_ends_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Voting has closed');
  END IF;
  
  SELECT EXISTS(SELECT 1 FROM public.suggestions WHERE id = p_suggestion_id AND round_id = p_round_id) INTO v_suggestion_exists;
  
  IF NOT v_suggestion_exists THEN
    RETURN json_build_object('success', false, 'error', 'Invalid suggestion for this round');
  END IF;
  
  SELECT EXISTS(SELECT 1 FROM public.votes WHERE round_id = p_round_id AND participant_id = p_participant_id) INTO v_user_already_voted;
  
  IF v_user_already_voted THEN
    RETURN json_build_object('success', false, 'error', 'You have already voted in this round');
  END IF;
  
  INSERT INTO public.votes (round_id, participant_id, suggestion_id)
  VALUES (p_round_id, p_participant_id, p_suggestion_id);
  
  RETURN json_build_object('success', true, 'message', 'Vote submitted successfully');
END $$;