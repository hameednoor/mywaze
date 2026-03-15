import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// DELETE /api/places/[id] — delete a custom place
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { error } = await supabase
    .from('custom_places')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
