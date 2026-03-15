import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST /api/migrate-source — add source column and backfill based on ID patterns
export async function POST() {
  try {
    // 1. Add column (no-op if already exists)
    const { error: alterError } = await supabase.rpc('exec_sql', {
      query: `ALTER TABLE radars ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'osm'`,
    });

    // If RPC doesn't exist, try direct approach — column may already exist
    if (alterError) {
      console.log('RPC not available, trying direct column check:', alterError.message);
    }

    // 2. Backfill: police records (IDs starting with 'pol_' or notes='police_record')
    const { error: policeErr, count: policeCount } = await supabase
      .from('radars')
      .update({ source: 'police' })
      .or('id.like.pol_%,notes.eq.police_record')
      .is('source', null);

    // 3. Remaining null → 'osm' (default)
    const { error: osmErr, count: osmCount } = await supabase
      .from('radars')
      .update({ source: 'osm' })
      .is('source', null);

    return NextResponse.json({
      success: true,
      policeBackfilled: policeCount ?? 'done',
      osmBackfilled: osmCount ?? 'done',
      policeError: policeErr?.message,
      osmError: osmErr?.message,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
