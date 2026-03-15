import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/radars — fetch all radars (paginated to bypass Supabase 1000 row limit)
export async function GET() {
  const allRows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('radars')
      .select('*')
      .order('id')
      .range(from, from + pageSize - 1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const radars = allRows.map(dbToRadar);
  return NextResponse.json(radars);
}

// POST /api/radars — add a new radar
export async function POST(req: NextRequest) {
  const body = await req.json();
  const row = radarToDb(body);

  const { data, error } = await supabase
    .from('radars')
    .insert(row)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(dbToRadar(data), { status: 201 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbToRadar(row: any) {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    roadName: row.road_name || '',
    emirate: row.emirate,
    direction: row.direction,
    speedLimit: row.speed_limit,
    radarType: row.radar_type,
    status: row.status,
    headingDegrees: row.heading_degrees || 0,
    lastVerified: row.last_verified,
    notes: row.notes || '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function radarToDb(radar: any) {
  return {
    id: radar.id,
    latitude: radar.latitude,
    longitude: radar.longitude,
    road_name: radar.roadName || '',
    emirate: radar.emirate,
    direction: radar.direction,
    speed_limit: radar.speedLimit,
    radar_type: radar.radarType,
    status: radar.status,
    heading_degrees: radar.headingDegrees || 0,
    last_verified: radar.lastVerified || null,
    notes: radar.notes || '',
  };
}

export { radarToDb, dbToRadar };
