import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, Block, Participant } from '@/types';

interface SummaryData {
  table: Table | null;
  blocks: Block[];
  participants: Participant[];
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


        setData({
          table: tableData,
          blocks: blocksData || [],
          participants: participantsData || [],
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