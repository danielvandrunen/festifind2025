import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase-client';
import { validateExtensionApiKey } from '../../../../lib/auth';

interface CreateFestivalRequest {
  name: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  country?: string;
  emails?: string[];
  notes?: string;
  url: string;
  source: string;
  apiKey: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateFestivalRequest = await request.json();
    
    // Validate API key first
    if (!body.apiKey || !validateExtensionApiKey(body.apiKey)) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!body.name || !body.url) {
      return NextResponse.json(
        { error: 'Festival name and URL are required' },
        { status: 400 }
      );
    }

    // Validate email format if emails are provided
    if (body.emails && body.emails.length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = body.emails.filter(email => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        return NextResponse.json(
          { error: `Invalid email format: ${invalidEmails.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Prepare festival data for database
    const festivalData = {
      name: body.name.trim(),
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      location: body.location?.trim() || null,
      country: body.country?.trim() || null,
      url: body.url.trim(),
      source: body.source || 'chrome-extension',
      emails: body.emails || [],
      notes: body.notes?.trim() || null,
      favorite: false,
      archived: false,
      sales_stage: 'favorited',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Check if festival already exists by URL
    const { data: existingFestival, error: checkError } = await supabase
      .from('festivals')
      .select('id, name, url')
      .eq('url', festivalData.url)
      .maybeSingle();

    if (checkError) {
      console.error('Error checking for existing festival:', checkError);
      return NextResponse.json(
        { error: 'Database error while checking for duplicates' },
        { status: 500 }
      );
    }

    if (existingFestival) {
      return NextResponse.json(
        { 
          error: 'Festival already exists',
          existingFestival: {
            id: existingFestival.id,
            name: existingFestival.name,
            url: existingFestival.url
          }
        },
        { status: 409 }
      );
    }

    // Create the festival
    const { data: newFestival, error: insertError } = await supabase
      .from('festivals')
      .insert(festivalData)
      .select()
      .single();

    if (insertError) {
      console.error('Error creating festival:', insertError);
      return NextResponse.json(
        { error: 'Failed to create festival', details: insertError.message },
        { status: 500 }
      );
    }

    console.log(`Successfully created festival: ${newFestival.name} (ID: ${newFestival.id})`);

    return NextResponse.json({
      success: true,
      message: 'Festival created successfully',
      festival: {
        id: newFestival.id,
        name: newFestival.name,
        start_date: newFestival.start_date,
        end_date: newFestival.end_date,
        location: newFestival.location,
        country: newFestival.country,
        url: newFestival.url,
        source: newFestival.source,
        emails: newFestival.emails,
        notes: newFestival.notes
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error in festival creation endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve festivals (for testing)
export async function GET(request: NextRequest) {
  try {
    // Get API key from header
    const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    if (!apiKey || !validateExtensionApiKey(apiKey)) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    // Get recent festivals created by extension
    const { data: festivals, error } = await supabase
      .from('festivals')
      .select('id, name, start_date, end_date, location, url, source, emails, created_at')
      .eq('source', 'chrome-extension')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching festivals:', error);
      return NextResponse.json(
        { error: 'Failed to fetch festivals' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      festivals: festivals || []
    });

  } catch (error) {
    console.error('Error in festival GET endpoint:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 