import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase-client';

interface Params {
  id: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;
  
  try {
    const body = await request.json();
    const { linkedin_url } = body;
    
    // Allow empty string to clear the field
    if (linkedin_url !== undefined && linkedin_url !== '' && typeof linkedin_url !== 'string') {
      return NextResponse.json({ 
        success: false, 
        message: 'LinkedIn URL must be a string' 
      }, { status: 400 });
    }

    // Basic LinkedIn URL validation if provided
    if (linkedin_url && !linkedin_url.includes('linkedin.com')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid LinkedIn URL - must contain linkedin.com' 
      }, { status: 400 });
    }

    // Update the festival with new LinkedIn URL
    const { data, error } = await supabase
      .from('festivals')
      .update({ 
        linkedin_url: linkedin_url || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating festival LinkedIn URL:', error);
      return NextResponse.json({ 
        success: false, 
        message: 'Database error when updating LinkedIn URL',
        error: error.message
      }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ 
        success: false, 
        message: 'Festival not found'
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: linkedin_url ? 'LinkedIn URL updated successfully' : 'LinkedIn URL removed',
      data: {
        id: data.id,
        linkedin_url: data.linkedin_url
      }
    });
    
  } catch (error: any) {
    console.error('Error processing LinkedIn URL update:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error processing request',
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;
  
  try {
    const { data, error } = await supabase
      .from('festivals')
      .select('id, linkedin_url')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching festival LinkedIn URL:', error);
      return NextResponse.json({ 
        success: false, 
        message: 'Festival not found',
        error: error.message
      }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      data: {
        id: data.id,
        linkedin_url: data.linkedin_url
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching LinkedIn URL:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error processing request',
      error: error.message
    }, { status: 500 });
  }
}
