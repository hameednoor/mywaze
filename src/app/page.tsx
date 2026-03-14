'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useGPS } from '@/lib/useGPS';
import { useRadarStore } from '@/lib/radarStore';
import { detectRadars } from '@/lib/radarDetection';
import { initAudio } from '@/lib/audio';
import { RadarAlert } from '@/lib/types';
import RadarAlertOverlay from '@/components/RadarAlertOverlay';
import SpeedDisplay from '@/components/SpeedDisplay';

// Dynamic import for MapLibre (no SSR)
const MapView = dynamic(() => import('@/components/Map'), { ssr: false });

export default function HomePage() {
  const { position, error: gpsError } = useGPS();
  const { radars, loadRadars } = useRadarStore();
  const [alert, setAlert] = useState<RadarAlert | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    loadRadars();
  }, [loadRadars]);

  // Radar detection loop
  useEffect(() => {
    if (!position) return;
    const result = detectRadars(position, radars);
    setAlert(result);
  }, [position, radars]);

  // Unlock audio on first user interaction
  const handleUserGesture = useCallback(() => {
    if (!audioReady) {
      initAudio();
      setAudioReady(true);
    }
  }, [audioReady]);

  return (
    <div
      className="h-[100dvh] w-screen relative overflow-hidden"
      onClick={handleUserGesture}
      onTouchStart={handleUserGesture}
    >
      {/* Map */}
      <MapView position={position} radars={radars} />

      {/* Radar alert overlays (side bars + distance popup) */}
      <RadarAlertOverlay alert={alert} />

      {/* Speed display */}
      <SpeedDisplay speedMs={position?.speed ?? null} nearestAlert={alert} />

      {/* GPS error banner */}
      {gpsError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-xl text-sm shadow-lg">
          GPS: {gpsError}
        </div>
      )}

      {/* Audio unlock prompt */}
      {!audioReady && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm shadow-lg cursor-pointer animate-pulse">
          Tap anywhere to enable radar alerts
        </div>
      )}

      {/* Admin link */}
      <a
        href="/admin"
        className="fixed z-30 bg-white/90 backdrop-blur-sm text-gray-700 px-3 py-2 rounded-lg text-xs font-medium shadow active:bg-white transition-colors"
        style={{ top: 'max(16px, env(safe-area-inset-top, 16px))', right: 'max(16px, env(safe-area-inset-right, 16px))' }}
      >
        Admin
      </a>

      {/* Radar count badge */}
      <div
        className="fixed z-30 bg-black/70 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-xs"
        style={{ bottom: 'max(16px, env(safe-area-inset-bottom, 16px))', right: 'max(16px, env(safe-area-inset-right, 16px))' }}
      >
        {radars.filter((r) => r.status === 'ACTIVE').length} radars loaded
      </div>
    </div>
  );
}
