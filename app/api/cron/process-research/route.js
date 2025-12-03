// @ts-nocheck
// Force ESM mode

import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase-client.js';
import { generateFestivalResearch } from '../../../../lib/openai-client.js';
import { generateFestivalResearchWithPerplexity } from '../../../../lib/perplexity-client.js';
import { generateFestivalResearchWithExa } from '../../../../lib/exa-client.js';

// Maximum duration for cron job
export const maxDuration = 300; // 5 minutes

/**
 * Cron job to process pending research requests
 * Runs every 2 minutes via Vercel Cron
 */
export async function GET(req) {
  try {
    console.log('🤖 [CRON] Starting research processing job...');
    
    // Verify this is a legitimate cron request
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('❌ [CRON] Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all pending research entries
    const { data: pendingResearch, error: fetchError } = await supabase
      .from('festival_research')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(5); // Process max 5 at a time to avoid timeouts

    if (fetchError) {
      console.error('❌ [CRON] Error fetching pending research:', fetchError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!pendingResearch || pendingResearch.length === 0) {
      console.log('😴 [CRON] No pending research found, job complete');
      return NextResponse.json({ 
        message: 'No pending research to process',
        processed: 0 
      });
    }

    console.log(`🔄 [CRON] Found ${pendingResearch.length} pending research entries to process`);

    let processed = 0;
    let errors = 0;

    // Process each pending research entry
    for (const research of pendingResearch) {
      try {
        console.log(`🔬 [CRON] Processing research ID: ${research.id} for festival: ${research.festival_id}`);
        
        // Get festival details
        const { data: festival, error: festivalError } = await supabase
          .from('festivals')
          .select('name')
          .eq('id', research.festival_id)
          .single();

        if (festivalError || !festival) {
          console.error(`❌ [CRON] Festival not found for research ID: ${research.id}`);
          // Mark as failed
          await supabase
            .from('festival_research')
            .update({
              status: 'failed',
              research_log: 'Festival not found',
              updated_at: new Date().toISOString()
            })
            .eq('id', research.id);
          errors++;
          continue;
        }

        const festivalName = festival.name;
        const aiService = research.ai_service || 'exa';

        console.log(`📡 [CRON] Starting ${aiService} research for: ${festivalName}`);

        // Generate research based on AI service
        let researchContent;
        const startTime = Date.now();

        if (aiService === 'perplexity') {
          researchContent = await generateFestivalResearchWithPerplexity(festivalName);
        } else if (aiService === 'exa') {
          researchContent = await generateFestivalResearchWithExa(festivalName);
        } else {
          researchContent = await generateFestivalResearch(festivalName);
        }

        const researchTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ [CRON] ${aiService} research completed for ${festivalName} in ${researchTime}s`);

        if (!researchContent || researchContent.length < 100) {
          throw new Error(`${aiService} returned insufficient research content (${researchContent?.length || 0} characters)`);
        }

        // Update research entry with results
        const { error: updateError } = await supabase
          .from('festival_research')
          .update({
            research_log: researchContent,
            status: 'complete',
            updated_at: new Date().toISOString()
          })
          .eq('id', research.id);

        if (updateError) {
          console.error(`❌ [CRON] Error updating research for ${festivalName}:`, updateError);
          errors++;
          continue;
        }

        console.log(`✅ [CRON] Research completed and saved for: ${festivalName}`);

        // Extract and save emails
        await extractAndSaveEmails(research.festival_id, researchContent, festivalName);

        processed++;

      } catch (error) {
        console.error(`❌ [CRON] Error processing research ID ${research.id}:`, error);
        
        // Mark research as failed
        try {
          await supabase
            .from('festival_research')
            .update({
              research_log: `Cron processing failed: ${error.message}`,
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', research.id);
        } catch (updateError) {
          console.error(`❌ [CRON] Error updating failed research status:`, updateError);
        }

        errors++;
      }
    }

    console.log(`🎉 [CRON] Job complete! Processed: ${processed}, Errors: ${errors}`);

    return NextResponse.json({
      message: 'Research processing complete',
      processed,
      errors,
      total: pendingResearch.length
    });

  } catch (error) {
    console.error('❌ [CRON] Critical error in research processing job:', error);
    return NextResponse.json({
      error: 'Critical processing error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Extract emails from research content and save to database
 */
async function extractAndSaveEmails(festivalId, researchContent, festivalName) {
  try {
    console.log(`📧 [CRON] Extracting emails for: ${festivalName}`);
    
    // Email extraction regex
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = researchContent.match(emailRegex) || [];
    
    if (emails.length === 0) {
      console.log(`📭 [CRON] No emails found for: ${festivalName}`);
      return;
    }

    // Clean and deduplicate emails
    const cleanEmails = [...new Set(emails.map(email => email.toLowerCase().trim()))];
    
    // Get existing emails for this festival
    const { data: festival, error: fetchError } = await supabase
      .from('festivals')
      .select('emails')
      .eq('id', festivalId)
      .single();

    if (fetchError) {
      console.error(`❌ [CRON] Error fetching existing emails for ${festivalName}:`, fetchError);
      return;
    }

    const existingEmails = festival.emails || [];
    const newEmails = cleanEmails.filter(email => !existingEmails.includes(email));

    if (newEmails.length === 0) {
      console.log(`📭 [CRON] No new emails found for: ${festivalName}`);
      return;
    }

    // Update festival with new emails
    const updatedEmails = [...existingEmails, ...newEmails];
    const { error: updateError } = await supabase
      .from('festivals')
      .update({ emails: updatedEmails })
      .eq('id', festivalId);

    if (updateError) {
      console.error(`❌ [CRON] Error updating emails for ${festivalName}:`, updateError);
      return;
    }

    console.log(`✅ [CRON] Added ${newEmails.length} new emails for ${festivalName}:`, newEmails);

  } catch (error) {
    console.error(`❌ [CRON] Error in email extraction for ${festivalName}:`, error);
  }
} 