import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting scheduled cleanup...')

    // Run comprehensive cleanup
    const { data, error } = await supabase.rpc('comprehensive_cleanup_stuck_tables')
    
    if (error) {
      throw error
    }

    const result = data as any
    console.log('Cleanup completed:', result)

    // Additional cleanup tasks
    if (result.success) {
      // Clean up old error logs or other maintenance tasks
      console.log(`Cleaned up ${result.updated_tables} tables, ${result.updated_rounds} rounds, created ${result.created_blocks} blocks`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        cleanup_result: result,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Scheduled cleanup error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})