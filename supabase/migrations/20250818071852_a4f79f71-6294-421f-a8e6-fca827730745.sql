-- Add unique constraint to blocks table to ensure idempotency
-- This prevents duplicate blocks for the same round
ALTER TABLE public.blocks 
ADD CONSTRAINT blocks_table_round_unique 
UNIQUE (table_id, round_id);