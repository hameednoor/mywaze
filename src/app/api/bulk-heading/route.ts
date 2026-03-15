import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/bulk-heading — bulk update radar headings
export async function POST(req: NextRequest) {
  const updates: { id: string; heading: number }[] = await req.json();

  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: 'Expected array' }, { status: 400 });
  }

  let updated = 0;
  const batchSize = 50;

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const promises = batch.map((u) =>
      supabase.from('radars').update({ heading_degrees: u.heading }).eq('id', u.id)
    );
    const results = await Promise.all(promises);
    updated += results.filter((r) => !r.error).length;
  }

  return NextResponse.json({ message: `Updated ${updated} radars` });
}
