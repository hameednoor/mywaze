import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const OWNER_EMAIL = process.env.OWNER_EMAIL || '';

function isOwner(email: string): boolean {
  return email.toLowerCase().trim() === OWNER_EMAIL.toLowerCase().trim();
}

// GET /api/auth/users — list all allowed users (owner only)
export async function GET(request: Request) {
  const ownerEmail = request.headers.get('x-user-email') || '';
  if (!isOwner(ownerEmail)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('allowed_users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST /api/auth/users — add a user (owner only)
export async function POST(request: Request) {
  const ownerEmail = request.headers.get('x-user-email') || '';
  if (!isOwner(ownerEmail)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { email, name } = await request.json();
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('allowed_users')
    .upsert({
      email: email.toLowerCase().trim(),
      name: name || '',
      is_active: true,
    }, { onConflict: 'email' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/auth/users — revoke a user (owner only)
export async function DELETE(request: Request) {
  const ownerEmail = request.headers.get('x-user-email') || '';
  if (!isOwner(ownerEmail)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('allowed_users')
    .update({ is_active: false })
    .eq('email', email.toLowerCase().trim());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
