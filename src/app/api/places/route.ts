import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/places — fetch custom places for a user
export async function GET(req: NextRequest) {
  const userEmail = req.headers.get('x-user-email') || '';

  let query = supabase
    .from('custom_places')
    .select('*')
    .order('added_at', { ascending: false });

  // Filter by user if email provided
  if (userEmail) {
    query = query.eq('user_email', userEmail.toLowerCase().trim());
  }

  const { data, error } = await query;

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

// POST /api/places — add a custom place for a user
export async function POST(req: NextRequest) {
  const userEmail = req.headers.get('x-user-email') || '';
  const body = await req.json();

  const { data, error } = await supabase
    .from('custom_places')
    .insert({
      id: body.id,
      name: body.name,
      latitude: body.latitude,
      longitude: body.longitude,
      added_at: body.addedAt || new Date().toISOString(),
      user_email: userEmail.toLowerCase().trim(),
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
