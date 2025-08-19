-- Phase 1: Fix existing data before applying constraints

-- Fix existing suggestions that are too long or empty
UPDATE suggestions 
SET text = SUBSTRING(text, 1, 500) 
WHERE char_length(text) > 500;

UPDATE suggestions 
SET text = '[Empty suggestion]' 
WHERE char_length(text) = 0 OR text IS NULL;

-- Fix existing participants with invalid display names
UPDATE participants 
SET display_name = SUBSTRING(display_name, 1, 50) 
WHERE char_length(display_name) > 50;

UPDATE participants 
SET display_name = 'Anonymous' 
WHERE char_length(display_name) = 0 OR display_name IS NULL;

-- Now apply the constraints safely
ALTER TABLE suggestions ADD CONSTRAINT valid_suggestion_length
CHECK (char_length(text) BETWEEN 1 AND 500);

ALTER TABLE participants ADD CONSTRAINT valid_display_name_length
CHECK (char_length(display_name) BETWEEN 1 AND 50);

ALTER TABLE rounds ADD CONSTRAINT valid_round_status 
CHECK (status IN ('lobby', 'suggest', 'vote', 'result'));