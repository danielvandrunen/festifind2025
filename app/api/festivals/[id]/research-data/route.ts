import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Get Supabase client - initialize lazily to ensure env vars are loaded
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase configuration is missing');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Research data schema for validation
const ResearchDataSchema = z.object({
  companyDiscovery: z.object({
    companyName: z.string().nullable(),
    kvkNumber: z.string().nullable(),
    confidence: z.enum(['high', 'medium', 'low']),
    source: z.string().optional(),
    allMatches: z.array(z.any()).optional(),
  }).optional(),
  linkedin: z.object({
    people: z.array(z.object({
      name: z.string(),
      title: z.string().optional(),
      url: z.string(),
      company: z.string().optional(),
    })).optional(),
    companies: z.array(z.object({
      name: z.string(),
      url: z.string(),
    })).optional(),
    searchedWith: z.string().optional(),
  }).optional(),
  news: z.object({
    articles: z.array(z.object({
      title: z.string(),
      url: z.string(),
      source: z.string().optional(),
      date: z.string().optional(),
      summary: z.string().optional(),
    })).optional(),
    lastSearched: z.string().optional(),
  }).optional(),
  calendarVerification: z.object({
    sources: z.array(z.object({
      name: z.string(),
      found: z.boolean(),
      url: z.string().optional(),
      editionYear: z.number().nullable().optional(),
      isCurrent: z.boolean().optional(),
    })).optional(),
    summary: z.object({
      foundOn: z.number(),
      totalSources: z.number(),
      isActiveOnCalendars: z.boolean(),
    }).optional(),
  }).optional(),
  websiteInfo: z.object({
    homepageUrl: z.string().optional(),
    discovered: z.boolean().optional(),
    lastScraped: z.string().optional(),
  }).optional(),
}).partial();

const UpdateRequestSchema = z.object({
  research_data: ResearchDataSchema.optional(),
  organizing_company: z.string().nullable().optional(),
  homepage_url: z.string().nullable().optional(),
  merge: z.boolean().default(true), // Whether to merge with existing data
});

interface Params {
  id: string;
}

/**
 * GET: Retrieve research data for a festival
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('festivals')
      .select('id, name, research_data, last_verified, organizing_company, homepage_url, url')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: 'Festival not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        festivalId: data.id,
        festivalName: data.name,
        festivalUrl: data.url,
        researchData: data.research_data,
        lastVerified: data.last_verified,
        organizingCompany: data.organizing_company,
        homepageUrl: data.homepage_url,
        hasResearch: data.research_data !== null,
      },
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST: Save/update research data for a festival
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const validationResult = UpdateRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request body',
        details: validationResult.error.flatten(),
      }, { status: 400 });
    }

    const { research_data, organizing_company, homepage_url, merge } = validationResult.data;
    const supabase = getSupabaseClient();

    // If merge is true, fetch existing data first
    let finalResearchData = research_data;
    if (merge && research_data) {
      const { data: existing } = await supabase
        .from('festivals')
        .select('research_data')
        .eq('id', id)
        .single();

      if (existing?.research_data) {
        // Deep merge existing data with new data
        finalResearchData = {
          ...existing.research_data,
          ...research_data,
          // Merge nested objects properly
          companyDiscovery: research_data.companyDiscovery ?? existing.research_data.companyDiscovery,
          linkedin: research_data.linkedin ?? existing.research_data.linkedin,
          news: research_data.news ?? existing.research_data.news,
          calendarVerification: research_data.calendarVerification ?? existing.research_data.calendarVerification,
          websiteInfo: research_data.websiteInfo ?? existing.research_data.websiteInfo,
        };
      }
    }

    // Build update object
    const updateData: Record<string, any> = {
      last_verified: new Date().toISOString(),
    };

    if (finalResearchData !== undefined) {
      updateData.research_data = finalResearchData;
    }
    if (organizing_company !== undefined) {
      updateData.organizing_company = organizing_company;
    }
    if (homepage_url !== undefined) {
      updateData.homepage_url = homepage_url;
    }

    const { data, error } = await supabase
      .from('festivals')
      .update(updateData)
      .eq('id', id)
      .select('id, name, research_data, last_verified, organizing_company, homepage_url');

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: 'Festival not found' }, { status: 404 });
    }

    console.log(`Research data saved for festival ${id}`);

    return NextResponse.json({
      success: true,
      data: {
        festivalId: data[0].id,
        festivalName: data[0].name,
        researchData: data[0].research_data,
        lastVerified: data[0].last_verified,
        organizingCompany: data[0].organizing_company,
        homepageUrl: data[0].homepage_url,
      },
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE: Clear research data for a festival
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;

  try {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('festivals')
      .update({
        research_data: null,
        last_verified: null,
        organizing_company: null,
        homepage_url: null,
      })
      .eq('id', id);

    if (error) {
      console.error('Supabase delete error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log(`Research data cleared for festival ${id}`);

    return NextResponse.json({
      success: true,
      message: 'Research data cleared',
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
