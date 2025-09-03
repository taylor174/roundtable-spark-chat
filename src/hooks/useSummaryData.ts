import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, Block, Participant, Suggestion, Vote, Round } from '@/types';

interface SummaryData {
  table: Table | null;
  blocks: Block[];
  participants: Participant[];
  rounds: Round[];
  suggestions: Suggestion[];
  votes: Vote[];
}

export function useSummaryData(tableCode: string) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tableCode) {
      setLoading(false);
      return;
    }

    const loadSummaryData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get table
        const { data: tableData, error: tableError } = await supabase
          .from('tables')
          .select('*')
          .eq('code', tableCode)
          .maybeSingle();

        if (tableError) {
          console.error('Database error loading table:', tableError);
          throw new Error(`Database error: ${tableError.message}`);
        }

        if (!tableData) {
          throw new Error('Table not found');
        }

        // Get blocks (completed rounds)
        
        const { data: blocksData, error: blocksError } = await supabase
          .from('blocks')
          .select('*')
          .eq('table_id', tableData.id)
          .order('created_at', { ascending: true });

        if (blocksError) {
          console.error('Database error loading blocks:', blocksError);
          throw new Error(`Failed to load discussion rounds: ${blocksError.message}`);
        }

        // Get participants
        const { data: participantsData, error: participantsError } = await supabase
          .from('participants')
          .select('*')
          .eq('table_id', tableData.id)
          .order('joined_at', { ascending: true });

        if (participantsError) {
          console.error('Database error loading participants:', participantsError);
          throw new Error(`Failed to load participants: ${participantsError.message}`);
        }

        // Get rounds
        const { data: roundsData, error: roundsError } = await supabase
          .from('rounds')
          .select('*')
          .eq('table_id', tableData.id)
          .order('number', { ascending: true });

        if (roundsError) {
          console.error('Database error loading rounds:', roundsError);
          throw new Error(`Failed to load rounds: ${roundsError.message}`);
        }

        // Get suggestions
        const { data: suggestionsData, error: suggestionsError } = await supabase
          .from('suggestions')
          .select(`
            *,
            participants!inner(display_name)
          `)
          .in('round_id', (roundsData || []).map(r => r.id));

        if (suggestionsError) {
          console.error('Database error loading suggestions:', suggestionsError);
          throw new Error(`Failed to load suggestions: ${suggestionsError.message}`);
        }

        // Get votes
        const { data: votesData, error: votesError } = await supabase
          .from('votes')
          .select(`
            *,
            participants!inner(display_name)
          `)
          .in('round_id', (roundsData || []).map(r => r.id));

        if (votesError) {
          console.error('Database error loading votes:', votesError);
          throw new Error(`Failed to load votes: ${votesError.message}`);
        }

        setData({
          table: tableData,
          blocks: blocksData || [],
          participants: participantsData || [],
          rounds: roundsData || [],
          suggestions: suggestionsData || [],
          votes: votesData || [],
        });
      } catch (err) {
        console.error('Error loading summary data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load summary data');
      } finally {
        setLoading(false);
      }
    };

    loadSummaryData();
  }, [tableCode]);

  return { data, loading, error };
}