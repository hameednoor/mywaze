'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — silently ignore
      });
    }

    // Capture install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      // Show banner after a short delay
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setShowBanner(false);
  }

  if (!showBanner || !installPrompt) return null;

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-50 bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3"
      style={{ bottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))' }}
    >
      <div className="flex-1">
        <p className="text-sm font-medium">Install MyWaze</p>
        <p className="text-xs text-gray-400">Add to home screen for the best experience</p>
      </div>
      <button
        onClick={handleInstall}
        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium active:bg-blue-700 flex-shrink-0"
      >
        Install
      </button>
      <button
        onClick={() => setShowBanner(false)}
        className="text-gray-400 text-lg leading-none flex-shrink-0"
      >
        &times;
      </button>
    </div>
  );
}
