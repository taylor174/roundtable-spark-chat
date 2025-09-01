import { supabase } from '@/integrations/supabase/client';

/**
 * Cleanup expired rounds that are stuck in suggestion phase
 */
export async function cleanupExpiredRounds() {
  try {
    // Force expired suggestion rounds to result phase
    const { error: roundsError } = await supabase
      .from('rounds')
      .update({ 
        status: 'result',
        ends_at: null 
      })
      .lt('ends_at', new Date().toISOString())
      .in('status', ['suggest', 'vote']);

    if (roundsError) {
      console.error('Error cleaning up expired rounds:', roundsError);
      return false;
    }

    // Sync table phase_ends_at with current round manually
    const { error: tablesError } = await supabase
      .from('tables')
      .update({ phase_ends_at: null })
      .not('current_round_id', 'is', null);
    
    if (tablesError) {
      console.error('Error syncing table timing:', tablesError);
      return false;
    }

    console.log('Successfully cleaned up expired rounds');
    return true;
  } catch (error) {
    console.error('Error in cleanup operation:', error);
    return false;
  }
}

/**
 * Auto-advance phases for rounds that should have ended
 */
export async function autoAdvanceStuckPhases(tableId: string, roundId: string, clientId: string) {
  try {
    const { error } = await supabase.rpc('advance_phase_atomic_v2', {
      p_table_id: tableId,
      p_round_id: roundId,
      p_client_id: clientId
    });

    if (error) {
      console.error('Error auto-advancing stuck phases:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in auto-advance operation:', error);
    return false;
  }
}