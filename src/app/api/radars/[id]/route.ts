import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PUT /api/radars/[id] — update a radar
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const { error } = await supabase
    .from('radars')
    .update({
      latitude: body.latitude,
      longitude: body.longitude,
      road_name: body.roadName || '',
      emirate: body.emirate,
      direction: body.direction,
      speed_limit: body.speedLimit,
      radar_type: body.radarType,
      status: body.status,
      heading_degrees: body.headingDegrees || 0,
      notes: body.notes || '',
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/radars/[id] — delete a radar
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { error } = await supabase
    .from('radars')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
