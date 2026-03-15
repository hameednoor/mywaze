import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/auth/approve?email=...&action=approve|deny
// Called when owner clicks approve/deny link in email
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email');
  const action = request.nextUrl.searchParams.get('action');

  if (!email || !action) {
    return new NextResponse(htmlPage('Invalid link', 'Missing email or action.', 'red'), {
      headers: { 'Content-Type': 'text/html' },
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (action === 'approve') {
    const { error } = await supabase
      .from('allowed_users')
      .update({ is_active: true })
      .eq('email', normalizedEmail);

    if (error) {
      return new NextResponse(htmlPage('Error', error.message, 'red'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new NextResponse(
      htmlPage('Approved', `${normalizedEmail} now has access to MyWaze.`, 'green'),
      { headers: { 'Content-Type': 'text/html' } }
    );
  } else if (action === 'deny') {
    const { error } = await supabase
      .from('allowed_users')
      .delete()
      .eq('email', normalizedEmail);

    if (error) {
      return new NextResponse(htmlPage('Error', error.message, 'red'), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new NextResponse(
      htmlPage('Denied', `${normalizedEmail} has been denied access.`, 'red'),
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  return new NextResponse(htmlPage('Invalid action', 'Use approve or deny.', 'red'), {
    headers: { 'Content-Type': 'text/html' },
  });
}

function htmlPage(title: string, message: string, color: string): string {
  const bg = color === 'green' ? '#22c55e' : '#ef4444';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} - MyWaze</title></head>
<body style="font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#111827;">
<div style="text-align:center;padding:40px;max-width:400px;">
  <div style="width:60px;height:60px;border-radius:50%;background:${bg};margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">
    <span style="color:white;font-size:28px;">${color === 'green' ? '✓' : '✕'}</span>
  </div>
  <h1 style="color:white;font-size:24px;margin:0 0 8px;">${title}</h1>
  <p style="color:#9ca3af;font-size:14px;margin:0;">${message}</p>
</div>
</body></html>`;
}
