import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '../../../../../lib/supabase-client';

interface Params {
  id: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { id } = await params;
    const { notes } = await request.json();

    if (typeof notes !== 'string') {
      console.error('Invalid input type for notes:', notes);
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('festivals')
      .update({ notes })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating notes:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in notes route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 