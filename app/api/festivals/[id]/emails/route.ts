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
    const { email } = body;
    
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ 
        success: false, 
        message: 'Email is required and must be a string' 
      }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid email format' 
      }, { status: 400 });
    }

    // Get current festival data
    const { data: festival, error: fetchError } = await supabase
      .from('festivals')
      .select('emails')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching festival:', fetchError);
      return NextResponse.json({ 
        success: false, 
        message: 'Festival not found',
        error: fetchError.message
      }, { status: 404 });
    }

    // Get current emails array or initialize empty array
    const currentEmails = festival.emails || [];
    
    // Check if email already exists
    if (currentEmails.includes(email.trim())) {
      return NextResponse.json({ 
        success: false, 
        message: 'Email already exists for this festival' 
      }, { status: 409 });
    }

    // Add new email to the array
    const updatedEmails = [...currentEmails, email.trim()];

    // Update the festival with new emails array
    const { data, error } = await supabase
      .from('festivals')
      .update({ 
        emails: updatedEmails,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating festival emails:', error);
      return NextResponse.json({ 
        success: false, 
        message: 'Database error when updating emails',
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Email added successfully',
      data: {
        id: data.id,
        emails: data.emails
      }
    });
    
  } catch (error: any) {
    console.error('Error processing email update:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Error processing request',
      error: error.message
    }, { status: 500 });
  }
} 