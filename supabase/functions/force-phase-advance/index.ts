import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PhaseAdvanceRequest {
  tableId: string;
  roundId: string;
  action: 'force_vote' | 'force_end' | 'force_next';
  clientId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { tableId, roundId, action, clientId }: PhaseAdvanceRequest = await req.json()

    console.log(`Force phase advance: ${action} for table ${tableId}, round ${roundId}`)

    // Verify the client is a host of this table
    const { data: hostCheck } = await supabaseClient
      .from('participants')
      .select('is_host')
      .eq('table_id', tableId)
      .eq('client_id', clientId)
      .single()

    if (!hostCheck?.is_host) {
      throw new Error('Only hosts can force phase advancement')
    }

    // Get current round and table info
    const { data: round } = await supabaseClient
      .from('rounds')
      .select('*, tables(*)')
      .eq('id', roundId)
      .single()

    if (!round) {
      throw new Error('Round not found')
    }

    const table = round.tables

    switch (action) {
      case 'force_vote':
        if (round.status !== 'suggest') {
          throw new Error('Can only force vote phase from suggest phase')
        }
        
        // Start vote phase immediately
        await supabaseClient.rpc('start_vote_phase_atomic', {
          p_round_id: roundId,
          p_table_id: tableId,
          p_ends_at: new Date(Date.now() + table.default_vote_sec * 1000).toISOString()
        })
        break

      case 'force_end':
        if (round.status !== 'vote') {
          throw new Error('Can only force end from vote phase')
        }
        
        // End round immediately, determining winner from current votes
        const { data: suggestions } = await supabaseClient
          .from('suggestions')
          .select(`
            *,
            votes:votes(count)
          `)
          .eq('round_id', roundId)

        // Find winner (most votes, then earliest created)
        const suggestionsWithCounts = suggestions?.map(s => ({
          ...s,
          voteCount: s.votes?.[0]?.count || 0
        })) || []

        const maxVotes = Math.max(...suggestionsWithCounts.map(s => s.voteCount), 0)
        const winners = suggestionsWithCounts.filter(s => s.voteCount === maxVotes)
        const winner = winners.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )[0]

        const winnerText = winner?.text || 'No suggestions received'

        // Update round to result
        await supabaseClient
          .from('rounds')
          .update({
            status: 'result',
            winner_suggestion_id: winner?.id || null,
            ends_at: null
          })
          .eq('id', roundId)

        // Create block
        await supabaseClient.rpc('upsert_block_safe', {
          p_table_id: tableId,
          p_round_id: roundId,
          p_suggestion_id: winner?.id || null,
          p_text: winnerText,
          p_is_tie_break: false
        })
        break

      case 'force_next':
        if (round.status !== 'result') {
          throw new Error('Can only advance to next round from result phase')
        }
        
        // Create next round
        const { data: newRound } = await supabaseClient
          .from('rounds')
          .insert({
            table_id: tableId,
            number: round.number + 1,
            status: 'suggest',
            started_at: new Date().toISOString(),
            ends_at: new Date(Date.now() + table.default_suggest_sec * 1000).toISOString()
          })
          .select()
          .single()

        // Update table to point to new round
        await supabaseClient
          .from('tables')
          .update({
            current_round_id: newRound.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', tableId)
        break

      default:
        throw new Error(`Unknown action: ${action}`)
    }

    // Trigger global refresh
    await supabaseClient
      .from('tables')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', tableId)

    return new Response(
      JSON.stringify({ success: true, message: `Phase advance ${action} completed` }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Force phase advance error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})