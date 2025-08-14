-- Update check constraints to allow new status values

-- Drop old constraint and create new one for tables.status
ALTER TABLE public.tables DROP CONSTRAINT IF EXISTS tables_status_check;
ALTER TABLE public.tables ADD CONSTRAINT tables_status_check CHECK (status IN ('lobby', 'running', 'closed'));

-- Update check constraints for rounds.status  
ALTER TABLE public.rounds DROP CONSTRAINT IF EXISTS rounds_status_check;
ALTER TABLE public.rounds ADD CONSTRAINT rounds_status_check CHECK (status IN ('lobby', 'suggest', 'vote', 'result'));