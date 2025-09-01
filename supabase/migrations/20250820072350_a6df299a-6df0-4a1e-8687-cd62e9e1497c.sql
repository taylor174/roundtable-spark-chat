-- Add presence tracking columns to participants table
ALTER TABLE public.participants 
ADD COLUMN last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN is_online BOOLEAN DEFAULT true;

-- Create index for efficient online status queries
CREATE INDEX idx_participants_online_status ON public.participants(table_id, is_online);