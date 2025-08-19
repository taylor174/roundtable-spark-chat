-- Allow participants to update their own suggestions during the suggestion phase
CREATE POLICY "Participants can update their own suggestions" 
ON suggestions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM participants p 
    JOIN rounds r ON r.id = suggestions.round_id 
    WHERE p.table_id = r.table_id 
    AND p.id = suggestions.participant_id
    AND r.status = 'suggestions'
  )
);