import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SummaryRequest {
  table_id: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting discussion summary email process');
    
    const { table_id }: SummaryRequest = await req.json();
    
    if (!table_id) {
      throw new Error('Table ID is required');
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch table data
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', table_id)
      .single();

    if (tableError) {
      console.error('Error fetching table:', tableError);
      throw new Error(`Failed to fetch table: ${tableError.message}`);
    }

    // Fetch blocks (completed rounds)
    const { data: blocks, error: blocksError } = await supabase
      .from('blocks')
      .select('*')
      .eq('table_id', table_id)
      .order('created_at', { ascending: true });

    if (blocksError) {
      console.error('Error fetching blocks:', blocksError);
      throw new Error(`Failed to fetch blocks: ${blocksError.message}`);
    }

    // Fetch participants count
    const { count: participantCount, error: participantError } = await supabase
      .from('participants')
      .select('*', { count: 'exact', head: true })
      .eq('table_id', table_id);

    if (participantError) {
      console.error('Error fetching participants:', participantError);
      throw new Error(`Failed to fetch participants: ${participantError.message}`);
    }

    // Generate email content
    const summaryUrl = `${Deno.env.get('SUPABASE_URL')?.replace('supabase.co', 'vercel.app') || 'https://your-app.vercel.app'}/summary/${table.code}`;
    
    const emailHtml = generateEmailHtml({
      table,
      blocks: blocks || [],
      participantCount: participantCount || 0,
      summaryUrl
    });

    // Get admin email addresses
    const adminEmails = Deno.env.get('ADMIN_EMAIL_ADDRESSES')?.split(',').map(email => email.trim()) || [
      'dror1492@gmail.com',
      'eladtz@gmail.com'
    ];

    console.log('Sending summary email to:', adminEmails);

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Discussion Summary <onboarding@resend.dev>",
      to: adminEmails,
      subject: `Discussion Summary: ${table.title || table.code}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ 
      success: true, 
      emailId: emailResponse.data?.id,
      recipients: adminEmails.length 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in send-discussion-summary function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function generateEmailHtml({ table, blocks, participantCount, summaryUrl }: {
  table: any;
  blocks: any[];
  participantCount: number;
  summaryUrl: string;
}) {
  const createdDate = new Date(table.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const duration = table.updated_at && table.created_at 
    ? Math.round((new Date(table.updated_at).getTime() - new Date(table.created_at).getTime()) / (1000 * 60))
    : 0;

  const timelineHtml = blocks.length > 0 
    ? blocks.map((block, index) => `
        <div style="margin: 16px 0; padding: 16px; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid #4f46e5;">
          <div style="font-weight: 600; color: #374151; margin-bottom: 8px;">
            Round ${index + 1}
          </div>
          <div style="color: #6b7280; font-size: 14px;">
            "${block.text}"
          </div>
          ${block.is_tie_break ? '<div style="color: #dc2626; font-size: 12px; margin-top: 4px;">🎯 Tie-breaker decision</div>' : ''}
        </div>
      `).join('')
    : '<div style="color: #6b7280; font-style: italic;">No rounds completed</div>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Discussion Summary</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      
      <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 32px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
        <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">
          Discussion Completed
        </h1>
        <p style="margin: 0; opacity: 0.9; font-size: 16px;">
          ${table.title || 'Untitled Discussion'}
        </p>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">Session Details</h2>
        
        <div style="display: grid; gap: 12px;">
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-weight: 600; color: #374151;">Discussion Code:</span>
            <span style="color: #6b7280;">${table.code}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-weight: 600; color: #374151;">Date:</span>
            <span style="color: #6b7280;">${createdDate}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-weight: 600; color: #374151;">Duration:</span>
            <span style="color: #6b7280;">${duration} minutes</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6;">
            <span style="font-weight: 600; color: #374151;">Participants:</span>
            <span style="color: #6b7280;">${participantCount}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; padding: 8px 0;">
            <span style="font-weight: 600; color: #374151;">Rounds Completed:</span>
            <span style="color: #6b7280;">${blocks.length}</span>
          </div>
        </div>
      </div>

      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 20px;">Discussion Timeline</h2>
        ${timelineHtml}
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${summaryUrl}" 
           style="display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          View Full Summary
        </a>
      </div>

      <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0;">
          This summary was automatically generated when the discussion session ended.
        </p>
      </div>

    </body>
    </html>
  `;
}

serve(handler);