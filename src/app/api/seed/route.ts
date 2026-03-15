import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import initialRadars from '@/data/radars.json';

// POST /api/seed — seed database with radars from JSON
export async function POST() {
  // Check if already seeded
  const { count } = await supabase
    .from('radars')
    .select('*', { count: 'exact', head: true });

  if (count && count > 0) {
    return NextResponse.json({ message: `Already seeded (${count} radars exist)` });
  }

  // Map to DB format and insert in batches of 500
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (initialRadars as any[]).map((r) => ({
    id: r.id,
    latitude: r.latitude,
    longitude: r.longitude,
    road_name: r.roadName || '',
    emirate: r.emirate,
    direction: r.direction,
    speed_limit: r.speedLimit,
    radar_type: r.radarType,
    status: r.status,
    heading_degrees: r.headingDegrees || 0,
    last_verified: r.lastVerified || null,
    notes: r.notes || '',
  }));

  let inserted = 0;
  const batchSize = 500;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase.from('radars').insert(batch);
    if (error) {
      return NextResponse.json(
        { error: error.message, inserted },
        { status: 500 }
      );
    }
    inserted += batch.length;
  }

  return NextResponse.json({ message: `Seeded ${inserted} radars` });
}
