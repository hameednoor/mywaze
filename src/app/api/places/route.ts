import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/places — fetch all custom places
export async function GET() {
  const { data, error } = await supabase
    .from('custom_places')
    .select('*')
    .order('added_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const places = (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    addedAt: row.added_at,
  }));

  return NextResponse.json(places);
}

// POST /api/places — add a custom place
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { data, error } = await supabase
    .from('custom_places')
    .insert({
      id: body.id,
      name: body.name,
      latitude: body.latitude,
      longitude: body.longitude,
      added_at: body.addedAt || new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    id: data.id,
    name: data.name,
    latitude: data.latitude,
    longitude: data.longitude,
    addedAt: data.added_at,
  }, { status: 201 });
}
