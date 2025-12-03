import { NextRequest, NextResponse } from 'next/server';

interface Params {
  id: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const { id } = await params;
  
  return NextResponse.json({ id, message: "Test archive route" });
} 