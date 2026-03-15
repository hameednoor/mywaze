'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useGPS } from '@/lib/useGPS';
import { useRadarStore } from '@/lib/radarStore';
import { useSettingsStore } from '@/lib/settingsStore';
import { usePlacesStore, SavedPlace } from '@/lib/placesStore';
import { detectRadars } from '@/lib/radarDetection';
import { initAudio } from '@/lib/audio';
import { RadarAlert } from '@/lib/types';
import { RouteData, distanceToRoute, getRouteWithWaypoints, findRadarsAlongRoute } from '@/lib/routing';
import RadarAlertOverlay from '@/components/RadarAlertOverlay';
import SpeedDisplay from '@/components/SpeedDisplay';

// Dynamic import for MapLibre (no SSR)
const MapView = dynamic(() => import('@/components/Map'), { ssr: false });

export default function HomePage() {
  const { position, error: gpsError } = useGPS();
  const { radars, loadRadars } = useRadarStore();
  const { loadSettings, keepScreenAwake, isDark } = useSettingsStore();
  const { places, loadPlaces } = usePlacesStore();
  const [alert, setAlert] = useState<RadarAlert | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [route, setRoute] = useState<RouteData | undefined>(undefined);
  const [routeRadarIds, setRouteRadarIds] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<{ lat: number; lng: number }[]>([]);
  const [rerouting, setRerouting] = useState(false);
  const reroutingRef = useRef(false);
  const lastRerouteRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const dark = isDark();

  useEffect(() => {
    loadRadars();
    loadSettings();
    loadPlaces();
  }, [loadRadars, loadSettings, loadPlaces]);

  // Parse route from URL params (from navigate page)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const routeParam = params.get('route');
      const routeRadarsParam = params.get('routeRadars');
      const destParam = params.get('destinations');
      if (routeParam) {
        const parsed = JSON.parse(routeParam);
        setRoute(parsed);
      }
      if (routeRadarsParam) {
        setRouteRadarIds(JSON.parse(routeRadarsParam));
      }
      if (destParam) {
        setDestinations(JSON.parse(destParam));
      }
    } catch { /* ignore */ }
  }, []);

  // Wake Lock
  useEffect(() => {
    async function requestWakeLock() {
      if (!keepScreenAwake || !('wakeLock' in navigator)) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch { /* ignore */ }
    }

    if (keepScreenAwake) {
      requestWakeLock();
      // Re-acquire on visibility change
      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && keepScreenAwake) {
          requestWakeLock();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        wakeLockRef.current?.release();
        wakeLockRef.current = null;
      };
    } else {
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    }
  }, [keepScreenAwake]);

  // Radar detection loop
  useEffect(() => {
    if (!position) return;
    const result = detectRadars(position, radars);
    setAlert(result);
  }, [position, radars]);

  // Deviation detection + auto-reroute
  useEffect(() => {
    if (!position || !route || destinations.length === 0) return;
    if (reroutingRef.current) return;
    // Throttle: don't reroute more than once every 10 seconds
    if (Date.now() - lastRerouteRef.current < 10000) return;

    const dist = distanceToRoute(position.latitude, position.longitude, route);
    if (dist <= 100) return; // Still on route

    // Off route — recalculate
    reroutingRef.current = true;
    setRerouting(true);
    lastRerouteRef.current = Date.now();

    getRouteWithWaypoints(position.latitude, position.longitude, destinations).then((newRoute) => {
      if (newRoute) {
        setRoute(newRoute);
        const newRadars = findRadarsAlongRoute(newRoute, radars);
        setRouteRadarIds(newRadars.map(r => r.id));
      }
      reroutingRef.current = false;
      setRerouting(false);
    }).catch(() => {
      reroutingRef.current = false;
      setRerouting(false);
    });
  }, [position, route, destinations, radars]);

  // Unlock audio on first user interaction
  const handleUserGesture = useCallback(() => {
    if (!audioReady) {
      initAudio();
      setAudioReady(true);
    }
  }, [audioReady]);

  const handlePlaceClick = useCallback((place: SavedPlace) => {
    // Could center map — handled by map component internally
  }, []);

  return (
    <div
      className="h-[100dvh] w-screen relative overflow-hidden"
      onClick={handleUserGesture}
      onTouchStart={handleUserGesture}
    >
      {/* Map */}
      <MapView
        position={position}
        radars={radars}
        route={route}
        routeRadarIds={routeRadarIds}
        savedPlaces={places}
        onPlaceClick={handlePlaceClick}
      />

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

      {/* Navigation buttons (top-right) */}
      <div
        className="fixed z-30 flex flex-col gap-2"
        style={{ top: 'max(16px, env(safe-area-inset-top, 16px))', right: 'max(16px, env(safe-area-inset-right, 16px))' }}
      >
        {/* Settings */}
        <a
          href="/settings"
          className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center active:bg-white transition-colors"
          title="Settings"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </a>

        {/* Search / Navigate */}
        <a
          href="/navigate"
          className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center active:bg-white transition-colors"
          title="Search & Navigate"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </a>

        {/* Saved Places */}
        <a
          href="/places"
          className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center active:bg-white transition-colors"
          title="Saved Places"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </a>

        {/* Admin */}
        <a
          href="/admin"
          className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center active:bg-white transition-colors"
          title="Admin"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </a>
      </div>

      {/* Route info bar (when navigating) */}
      {route && (
        <div
          className="fixed left-4 right-4 z-30 bg-black/80 backdrop-blur-sm text-white rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{ top: 'max(70px, calc(env(safe-area-inset-top, 0px) + 70px))' }}
        >
          <div className="flex-1">
            <p className="text-xs text-gray-300">
              {rerouting ? 'Rerouting...' : 'Navigating'}
              {route.distanceKm ? ` · ${route.distanceKm.toFixed(1)} km` : ''}
              {route.durationMin ? ` · ${Math.round(route.durationMin)} min` : ''}
            </p>
            {routeRadarIds.length > 0 && (
              <p className="text-xs text-red-400 font-medium">
                {routeRadarIds.length} radar{routeRadarIds.length !== 1 ? 's' : ''} on route
              </p>
            )}
          </div>
          <button
            onClick={() => { setRoute(undefined); setRouteRadarIds([]); setDestinations([]); window.history.replaceState({}, '', '/'); }}
            className="text-xs text-red-400 font-medium px-3 py-1.5 bg-white/10 rounded-lg"
          >
            End
          </button>
        </div>
      )}

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
