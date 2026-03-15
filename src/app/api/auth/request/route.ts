import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabase } from '@/lib/supabase';

const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER_EMAIL = process.env.OWNER_EMAIL || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://mywaze.vercel.app';

// POST /api/auth/request — user requests access
export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already has access
    const { data: existing } = await supabase
      .from('allowed_users')
      .select('email, is_active')
      .eq('email', normalizedEmail)
      .single();

    if (existing?.is_active) {
      return NextResponse.json({ error: 'Already has access' }, { status: 400 });
    }

    // Store as pending (is_active = false)
    await supabase
      .from('allowed_users')
      .upsert({
        email: normalizedEmail,
        name: name || '',
        is_active: false,
      }, { onConflict: 'email' });

    // Send email to owner with approve/deny links
    const approveUrl = `${APP_URL}/api/auth/approve?email=${encodeURIComponent(normalizedEmail)}&action=approve`;
    const denyUrl = `${APP_URL}/api/auth/approve?email=${encodeURIComponent(normalizedEmail)}&action=deny`;

    const emailResult = await resend.emails.send({
      from: 'MyWaze <onboarding@resend.dev>',
      to: OWNER_EMAIL,
      subject: `Access Request: ${name || normalizedEmail}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 8px;">New Access Request</h2>
          <p style="color: #666; font-size: 14px; margin-bottom: 24px;">Someone wants access to MyWaze Radar Navigator.</p>

          <div style="background: #f5f5f5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #1a1a1a;">${name || 'Unknown'}</p>
            <p style="margin: 0; font-size: 14px; color: #666;">${normalizedEmail}</p>
          </div>

          <div style="display: flex; gap: 12px;">
            <a href="${approveUrl}" style="display: inline-block; padding: 12px 32px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Approve</a>
            <a href="${denyUrl}" style="display: inline-block; padding: 12px 32px; background: #ef4444; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Deny</a>
          </div>
        </div>
      `,
    });

    if (emailResult.error) {
      console.error('Resend error:', emailResult.error);
      return NextResponse.json({ success: true, message: 'Request saved but email failed', emailError: emailResult.error });
    }

    return NextResponse.json({ success: true, message: 'Request sent' });
  } catch (err) {
    console.error('Access request error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
