import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const OWNER_EMAIL = process.env.OWNER_EMAIL || '';

// POST /api/auth — check if user is allowed
export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ allowed: false, error: 'No email' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isOwner = normalizedEmail === OWNER_EMAIL.toLowerCase().trim();

    // Owner always has access
    if (isOwner) {
      return NextResponse.json({ allowed: true, isOwner: true });
    }

    // Check allowed_users table
    const { data, error } = await supabase
      .from('allowed_users')
      .select('email, is_active')
      .eq('email', normalizedEmail)
      .single();

    if (error || !data) {
      return NextResponse.json({ allowed: false, isOwner: false });
    }

    return NextResponse.json({ allowed: data.is_active === true, isOwner: false });
  } catch {
    return NextResponse.json({ allowed: false, error: 'Server error' }, { status: 500 });
  }
}
