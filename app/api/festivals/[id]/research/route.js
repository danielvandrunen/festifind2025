// @ts-nocheck
// Force ESM mode

import { NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase-client.js';
import { generateFestivalResearch } from '../../../../../lib/openai-client.js';
import { generateFestivalResearchWithPerplexity } from '../../../../../lib/perplexity-client.js';
import { generateFestivalResearchWithExa } from '../../../../../lib/exa-client.js';

// Maximum duration for edge runtime
export const maxDuration = 120; // 120 seconds

/**
 * POST handler for festival research
 * Initiates research for a specific festival
 */
export async function POST(req, { params }) {
  try {
    // Correctly access the params
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    // Get request body to check for AI service preference
    const body = await req.json();
    const aiService = body.aiService || 'exa'; // Default to EXA
    
    console.log(`POST initiating research for festival ID: ${id} using ${aiService}`);
    
    // Check if research already exists
    const { data: existing, error: checkError } = await supabase
      .from('festival_research')
      .select('id, status')
      .eq('festival_id', id)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking existing research:', checkError);
      return NextResponse.json({
        error: 'Failed to check for existing research', 
        details: checkError.message
      }, { status: 500 });
    }
    
    // If research already exists and is complete, return it
    if (existing && existing.status === 'complete') {
      console.log(`Research already exists for festival ID: ${id} and is complete`);
      return NextResponse.json({
        message: 'Research already exists',
        researchId: existing.id,
        status: 'complete'
      });
    }
    
    // If research already exists but is pending, update the timestamp and return it
    if (existing && existing.status === 'pending') {
      console.log(`Research already exists for festival ID: ${id} and is pending`);
      
      // Update the updated_at timestamp to show we tried again
      const { error: updateError } = await supabase
        .from('festival_research')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existing.id);
        
      if (updateError) {
        console.error('Error updating research timestamp:', updateError);
      }
      
      return NextResponse.json({
        message: 'Research already in progress',
        researchId: existing.id,
        status: 'pending'
      });
    }
    
    // If research already exists but failed, we'll recreate it
    if (existing && existing.status === 'failed') {
      console.log(`Previous research failed for festival ID: ${id}, recreating`);
      
      // Delete the failed entry
      const { error: deleteError } = await supabase
        .from('festival_research')
        .delete()
        .eq('id', existing.id);
        
      if (deleteError) {
        console.error('Error deleting failed research:', deleteError);
      }
    }
    
    // Get the festival details
    const { data: festival, error: festivalError } = await supabase
      .from('festivals')
      .select('*')
      .eq('id', id)
      .single();
    
    if (festivalError) {
      console.error('Error fetching festival:', festivalError);
      return NextResponse.json({
        error: 'Failed to fetch festival details', 
        details: festivalError.message
      }, { status: 404 });
    }
    
    // Create a new research entry with AI service info
    const { data: newResearch, error: insertError } = await supabase
      .from('festival_research')
      .insert({
        festival_id: id,
        research_log: `Research in progress using ${aiService.toUpperCase()}...`,
        status: 'pending',
        ai_service: aiService
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating research:', insertError);
      return NextResponse.json({
        error: 'Failed to create research entry', 
        details: insertError.message
      }, { status: 500 });
    }
    
    // Research will be processed by the cron job
    console.log(`🚀 Research queued for processing via cron job for ${festival.name} (ID: ${id}) using ${aiService}`);
    console.log(`⏰ Research will be processed by cron job within 2 minutes`)
    
    return NextResponse.json({
      message: 'Research initiated successfully',
      researchId: newResearch.id,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error creating research:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred', 
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET handler for festival research
 * Retrieves research for a specific festival
 */
export async function GET(req, { params }) {
  try {
    // Correctly access the params
    const resolvedParams = await params;
    const id = resolvedParams.id;
    
    console.log(`GET research for festival ID: ${id}`);
    
    // Fetch research for the festival
    const { data, error } = await supabase
      .from('festival_research')
      .select('*')
      .eq('festival_id', id)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching research:', error);
      return NextResponse.json({
        error: 'Failed to fetch research data', 
        details: error.message
      }, { status: 500 });
    }
    
    // If no research found
    if (!data) {
      return NextResponse.json({
        error: 'Research not found for this festival'
      }, { status: 404 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching research:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred', 
      details: error.message
    }, { status: 500 });
  }
}

/**
 * Extract email addresses from research content
 */
function extractEmailsFromResearchContent(researchContent) {
  const emails = [];
  
  try {
    // Look for email pattern in the KEY BUSINESS INFORMATION section
    const emailRegex = /(?:📧|email).*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
    let match;
    
    while ((match = emailRegex.exec(researchContent)) !== null) {
      const email = match[1].toLowerCase().trim();
      if (email && !emails.includes(email)) {
        emails.push(email);
      }
    }
    
    // Also look for standalone email patterns in the content
    const standaloneEmailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
    let standaloneMatch;
    
    while ((standaloneMatch = standaloneEmailRegex.exec(researchContent)) !== null) {
      const email = standaloneMatch[0].toLowerCase().trim();
      if (email && !emails.includes(email)) {
        emails.push(email);
      }
    }
    
    console.log('Extracted emails from research:', emails);
    return emails;
  } catch (error) {
    console.error('Error extracting emails:', error);
    return [];
  }
}

/**
 * Auto-extract and populate emails from research content
 */
async function autoExtractEmailsFromResearch(festivalId, researchContent) {
  try {
    const extractedEmails = extractEmailsFromResearchContent(researchContent);
    
    if (extractedEmails.length === 0) {
      console.log('No emails found in research content');
      return;
    }
    
    console.log(`Auto-populating ${extractedEmails.length} emails for festival ${festivalId}`);
    
    // Get current festival emails to avoid duplicates
    const { data: festival } = await supabase
      .from('festivals')
      .select('emails')
      .eq('id', festivalId)
      .single();
    
    const currentEmails = festival?.emails || [];
    const newEmails = extractedEmails.filter(email => !currentEmails.includes(email));
    
    if (newEmails.length === 0) {
      console.log('All extracted emails already exist in festival');
      return;
    }
    
    // Update festival with new emails
    const updatedEmails = [...currentEmails, ...newEmails];
    const { error } = await supabase
      .from('festivals')
      .update({ emails: updatedEmails })
      .eq('id', festivalId);
    
    if (error) {
      console.error('Error updating festival emails:', error);
    } else {
      console.log(`Successfully added ${newEmails.length} new emails:`, newEmails);
    }
  } catch (error) {
    console.error('Error auto-extracting emails:', error);
  }
}

/**
 * Background function to generate research
 * This runs asynchronously after the request returns
 */
async function generateResearchInBackground(festivalId, festivalName, researchId, aiService = 'exa') {
  const startTime = Date.now();
  try {
    console.log(`🔬 Starting research process for festival: ${festivalName} using ${aiService} (Research ID: ${researchId})`);
    
    // Generate the research using the selected AI service
    let researchContent;
    console.log(`📡 Calling ${aiService} API for ${festivalName}...`);
    
    if (aiService === 'perplexity') {
      researchContent = await generateFestivalResearchWithPerplexity(festivalName);
    } else if (aiService === 'exa') {
      researchContent = await generateFestivalResearchWithExa(festivalName);
    } else {
      researchContent = await generateFestivalResearch(festivalName);
    }
    
    const researchTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ ${aiService} research completed for ${festivalName} in ${researchTime}s`);
    
    if (!researchContent || researchContent.length < 100) {
      throw new Error(`${aiService} returned insufficient research content (${researchContent?.length || 0} characters)`);
    }
    
    console.log(`Research completed for ${festivalName} using ${aiService}, updating database...`);
    
    // Update the research entry with the content and mark as complete
    const { error } = await supabase
      .from('festival_research')
      .update({
        research_log: researchContent,
        status: 'complete',
        updated_at: new Date().toISOString()
      })
      .eq('id', researchId);
    
    if (error) {
      console.error(`Error updating research for ${festivalName}:`, error);
      throw error;
    }
    
    console.log(`Research for ${festivalName} completed and saved successfully!`);
    
    // Auto-extract and populate emails from research content
    console.log(`📧 Extracting emails from research content for ${festivalName}...`);
    await autoExtractEmailsFromResearch(festivalId, researchContent);
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`🎉 Research and email extraction completed for ${festivalName} in ${totalTime}s total`);
  } catch (error) {
    console.error(`Error generating research for ${festivalName}:`, error);
    
    // Update the research entry to mark as failed
    const { error: updateError } = await supabase
      .from('festival_research')
      .update({
        research_log: `Research failed: ${error.message}`,
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('id', researchId);
    
    if (updateError) {
      console.error(`Error updating research status for ${festivalName}:`, updateError);
    }
  }
} 