import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/bulk-update — bulk update radar direction
export async function POST(req: NextRequest) {
  const { direction } = await req.json();

  const { error, count } = await supabase
    .from('radars')
    .update({ direction })
    .neq('direction', direction);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: `Updated ${count} radars to ${direction}` });
}
