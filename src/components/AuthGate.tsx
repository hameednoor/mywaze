'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuthStore } from '@/lib/authStore';
import Script from 'next/script';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

// Extend window for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleCredentialResponse {
  credential: string;
}

function decodeJwt(token: string): Record<string, string> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, checked, allowed, setUser, setAllowed, setIsOwner, setChecked, loadFromStorage, signOut } = useAuthStore();
  const btnRef = useRef<HTMLDivElement>(null);
  const googleLoaded = useRef(false);

  // Load stored user on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Check access when user changes
  useEffect(() => {
    if (!user) {
      setChecked(true);
      return;
    }

    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    })
      .then((res) => res.json())
      .then((data) => {
        setAllowed(data.allowed);
        setIsOwner(data.isOwner || false);
        setChecked(true);
      })
      .catch(() => {
        setAllowed(false);
        setChecked(true);
      });
  }, [user, setAllowed, setIsOwner, setChecked]);

  const handleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
      try {
        const payload = decodeJwt(response.credential);
        setUser({
          email: payload.email,
          name: payload.name || payload.email,
          picture: payload.picture || '',
        });
      } catch {
        /* ignore */
      }
    },
    [setUser]
  );

  const initGoogle = useCallback(() => {
    if (!window.google || googleLoaded.current) return;
    googleLoaded.current = true;

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
      auto_select: true,
    });

    if (btnRef.current) {
      window.google.accounts.id.renderButton(btnRef.current, {
        type: 'standard',
        theme: 'filled_blue',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 280,
      });
    }
  }, [handleCredential]);

  // Not checked yet — loading
  if (!checked) {
    return (
      <div className="h-[100dvh] w-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // No user — show sign in
  if (!user) {
    return (
      <>
        <Script
          src="https://accounts.google.com/gsi/client"
          onLoad={initGoogle}
          strategy="afterInteractive"
        />
        <div className="h-[100dvh] w-screen flex items-center justify-center bg-gray-900 text-white">
          <div className="text-center px-6 max-w-sm">
            <div className="text-5xl mb-4">📡</div>
            <h1 className="text-2xl font-bold mb-2">MyWaze</h1>
            <p className="text-sm text-gray-400 mb-8">UAE Radar Navigator</p>
            <div ref={btnRef} className="flex justify-center" />
            <p className="text-xs text-gray-500 mt-6">Sign in with Google to continue</p>
          </div>
        </div>
      </>
    );
  }

  // User signed in but not allowed
  if (!allowed) {
    return <AccessRequestScreen user={user} signOut={signOut} />;
  }

  // Allowed — render app
  return <>{children}</>;
}

function AccessRequestScreen({ user, signOut }: { user: { email: string; name: string }; signOut: () => void }) {
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState('');

  const handleRequest = async () => {
    setRequesting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, name: user.name }),
      });
      const data = await res.json();
      if (data.success) {
        setRequested(true);
      } else {
        setError(data.error || 'Failed to send request');
      }
    } catch {
      setError('Failed to send request');
    }
    setRequesting(false);
  };

  return (
    <div className="h-[100dvh] w-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center px-6 max-w-sm">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-xl font-bold mb-2">Access Required</h1>
        <p className="text-sm text-gray-400 mb-2">
          Signed in as <span className="text-white font-medium">{user.email}</span>
        </p>
        {requested ? (
          <div className="mt-6">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-sm text-green-400 font-medium">Request sent!</p>
            <p className="text-xs text-gray-400 mt-2">The app owner has been notified. You&apos;ll get access once approved.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-6">
              You don&apos;t have access yet. Request access and the owner will be notified.
            </p>
            <button
              onClick={handleRequest}
              disabled={requesting}
              className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium active:bg-blue-700 disabled:opacity-40 mb-3"
            >
              {requesting ? 'Sending...' : 'Request Access'}
            </button>
            {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          </>
        )}
        <button
          onClick={signOut}
          className="px-6 py-2.5 bg-gray-700 text-white rounded-xl text-sm font-medium active:bg-gray-600 mt-2"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
