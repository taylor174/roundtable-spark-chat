import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SummaryData {
  table: any;
  blocks: any[];
  participants: any[];
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

    const { tableCode } = await req.json()
    
    if (!tableCode) {
      return new Response(
        JSON.stringify({ error: 'Table code is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log(`Auto-saving summary to GitHub for table: ${tableCode}`)

    // Get table data
    const { data: tableData, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('code', tableCode)
      .maybeSingle()

    if (tableError || !tableData) {
      throw new Error(`Table not found: ${tableError?.message || 'Unknown error'}`)
    }

    // Get blocks (completed rounds)
    const { data: blocksData, error: blocksError } = await supabase
      .from('blocks')
      .select('*')
      .eq('table_id', tableData.id)
      .order('created_at', { ascending: true })

    if (blocksError) {
      throw new Error(`Failed to load blocks: ${blocksError.message}`)
    }

    // Get participants
    const { data: participantsData, error: participantsError } = await supabase
      .from('participants')
      .select('*')
      .eq('table_id', tableData.id)
      .order('joined_at', { ascending: true })

    if (participantsError) {
      throw new Error(`Failed to load participants: ${participantsError.message}`)
    }

    const summaryData: SummaryData = {
      table: tableData,
      blocks: blocksData || [],
      participants: participantsData || [],
    }

    // Generate HTML content (same as export functionality)
    const htmlContent = generateSummaryHTML(summaryData)

    // Save to GitHub
    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (!githubToken) {
      throw new Error('GitHub token not configured')
    }

    // Configure these based on your setup
    const owner = 'YOUR_USERNAME' // Replace with actual username
    const repo = 'YOUR_REPO_NAME' // Replace with actual repo name
    const path = `discussion-summaries/${sanitizeFilename(tableData.title)}-${tableCode}-${new Date().toISOString().split('T')[0]}.html`

    const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `Auto-save discussion summary: ${tableData.title} (${tableCode})`,
        content: btoa(htmlContent),
        branch: 'main'
      })
    })

    if (!githubResponse.ok) {
      const errorData = await githubResponse.text()
      throw new Error(`GitHub API error: ${githubResponse.status} - ${errorData}`)
    }

    const result = await githubResponse.json()
    console.log('Successfully saved to GitHub:', result.content.html_url)

    return new Response(
      JSON.stringify({ 
        success: true, 
        github_url: result.content.html_url,
        path: path
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Auto-save to GitHub error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Internal server error' 
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

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function generateSummaryHTML(data: SummaryData): string {
  const { table, blocks, participants } = data
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discussion Summary - ${table.title || table.code}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 2rem;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem 2rem;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
        }
        
        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            padding: 2rem;
            background: #f8fafc;
        }
        
        .stat {
            text-align: center;
            padding: 1.5rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            color: #667eea;
            display: block;
        }
        
        .stat-label {
            font-size: 0.9rem;
            color: #64748b;
            margin-top: 0.5rem;
        }
        
        .content {
            padding: 2rem;
        }
        
        .section {
            margin-bottom: 2rem;
        }
        
        .section h2 {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .timeline {
            position: relative;
            padding-left: 2rem;
        }
        
        .timeline::before {
            content: '';
            position: absolute;
            left: 0.75rem;
            top: 0;
            bottom: 0;
            width: 2px;
            background: linear-gradient(to bottom, #667eea, #764ba2);
        }
        
        .timeline-item {
            position: relative;
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            border-left: 4px solid #667eea;
        }
        
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -2.75rem;
            top: 1.5rem;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #667eea;
            border: 3px solid white;
            box-shadow: 0 0 0 3px #667eea;
        }
        
        .round-header {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 0.5rem;
        }
        
        .round-text {
            font-size: 1rem;
            color: #475569;
            line-height: 1.6;
        }
        
        .participants-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
        }
        
        .participant {
            padding: 1rem;
            background: #f8fafc;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        
        .participant-name {
            font-weight: 600;
            color: #1e293b;
        }
        
        .participant-role {
            font-size: 0.875rem;
            color: #64748b;
            margin-top: 0.25rem;
        }
        
        .footer {
            background: #f8fafc;
            padding: 2rem;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 0.9rem;
        }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            
            .container {
                box-shadow: none;
                border-radius: 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${table.title || 'Discussion Summary'}</h1>
            <p>Code: ${table.code} • ${new Date(table.created_at).toLocaleDateString()}</p>
        </div>
        
        <div class="stats">
            <div class="stat">
                <span class="stat-number">${blocks.length}</span>
                <div class="stat-label">Discussion Rounds</div>
            </div>
            <div class="stat">
                <span class="stat-number">${participants.length}</span>
                <div class="stat-label">Participants</div>
            </div>
            <div class="stat">
                <span class="stat-number">${table.status === 'closed' ? 'Completed' : 'In Progress'}</span>
                <div class="stat-label">Status</div>
            </div>
        </div>
        
        <div class="content">
            ${table.description ? `
            <div class="section">
                <h2>Description</h2>
                <p>${table.description}</p>
            </div>
            ` : ''}
            
            <div class="section">
                <h2>Discussion Timeline</h2>
                ${blocks.length > 0 ? `
                <div class="timeline">
                    ${blocks.map((block, index) => `
                    <div class="timeline-item">
                        <div class="round-header">Round ${index + 1}</div>
                        <div class="round-text">${block.text}</div>
                    </div>
                    `).join('')}
                </div>
                ` : '<p>No discussion rounds completed.</p>'}
            </div>
            
            <div class="section">
                <h2>Participants</h2>
                <div class="participants-list">
                    ${participants.map(participant => `
                    <div class="participant">
                        <div class="participant-name">${participant.name}</div>
                        <div class="participant-role">${participant.is_host ? 'Host' : 'Participant'}</div>
                    </div>
                    `).join('')}
                </div>
            </div>
        </div>
        
        <div class="footer">
            Generated on ${new Date().toLocaleString()}
        </div>
    </div>
</body>
</html>`
}