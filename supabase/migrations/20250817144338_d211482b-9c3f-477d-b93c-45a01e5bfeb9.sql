-- Add auto_advance field to tables (default true)
ALTER TABLE public.tables 
ADD COLUMN auto_advance boolean NOT NULL DEFAULT true;

-- Add is_tie_break field to blocks table to track tie-break winners
ALTER TABLE public.blocks 
ADD COLUMN is_tie_break boolean NOT NULL DEFAULT false;