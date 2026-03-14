'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRadarStore } from '@/lib/radarStore';
import { useSettingsStore } from '@/lib/settingsStore';
import { searchPlaces, getRoute, findRadarsAlongRoute, SearchResult, RouteData } from '@/lib/routing';
import { Radar } from '@/lib/types';

const MapView = dynamic(() => import('@/components/Map'), { ssr: false });

export default function NavigatePage() {
  const { radars, loadRadars } = useRadarStore();
  const { isDark, loadSettings } = useSettingsStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [destination, setDestination] = useState<SearchResult | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeRadars, setRouteRadars] = useState<Radar[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadRadars();
    loadSettings();
  }, [loadRadars, loadSettings]);

  // Get current position once
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const dark = isDark();

  // Debounced search
  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    setError('');
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchPlaces(q);
        setResults(res);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 400);
  }, []);

  async function selectDestination(result: SearchResult) {
    setDestination(result);
    setResults([]);
    setQuery(result.displayName.split(',')[0]);

    if (!userPos) {
      setError('Waiting for GPS location...');
      return;
    }

    setCalculating(true);
    setError('');
    const routeData = await getRoute(userPos.lat, userPos.lng, result.lat, result.lon);
    if (routeData) {
      setRoute(routeData);
      const radarsOnRoute = findRadarsAlongRoute(routeData, radars);
      setRouteRadars(radarsOnRoute);
    } else {
      setError('Could not calculate route');
    }
    setCalculating(false);
  }

  function clearRoute() {
    setRoute(null);
    setRouteRadars([]);
    setDestination(null);
    setQuery('');
    setError('');
  }

  return (
    <div className={`h-[100dvh] flex flex-col overflow-hidden ${dark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Top bar */}
      <div className={`${dark ? 'bg-gray-800' : 'bg-gray-900'} text-white px-4 py-3 flex-shrink-0 z-20`}
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">&larr; Map</a>
          <h1 className="text-lg font-bold flex-1">Route Planner</h1>
          {route && (
            <button onClick={clearRoute} className="text-red-400 text-sm font-medium">Clear</button>
          )}
        </div>

        {/* Search box */}
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search destination..."
            className={`w-full rounded-xl px-4 py-2.5 text-sm ${
              dark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-white text-gray-900 placeholder-gray-500'
            }`}
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search results dropdown */}
        {results.length > 0 && (
          <div className={`mt-1 rounded-xl overflow-hidden shadow-lg max-h-[40vh] overflow-y-auto ${
            dark ? 'bg-gray-700' : 'bg-white'
          }`}>
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => selectDestination(r)}
                className={`w-full text-left px-4 py-3 text-sm border-b last:border-b-0 transition-colors ${
                  dark
                    ? 'border-gray-600 hover:bg-gray-600 text-white'
                    : 'border-gray-100 hover:bg-gray-50 text-gray-900'
                }`}
              >
                <p className="font-medium truncate">{r.displayName.split(',')[0]}</p>
                <p className={`text-xs truncate ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {r.displayName.split(',').slice(1).join(',').trim()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Route info bar */}
      {route && (
        <div className={`${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3 flex-shrink-0 z-10`}>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium truncate">{destination?.displayName.split(',')[0]}</p>
              <div className="flex gap-4 mt-1">
                <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {route.distanceKm.toFixed(1)} km
                </span>
                <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {Math.round(route.durationMin)} min
                </span>
                {routeRadars.length > 0 && (
                  <span className="text-xs text-red-500 font-medium">
                    {routeRadars.length} radar{routeRadars.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <a
              href={`/?route=${encodeURIComponent(JSON.stringify({ coordinates: route.coordinates, geometry: route.geometry }))}&routeRadars=${encodeURIComponent(JSON.stringify(routeRadars.map(r => r.id)))}`}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium active:bg-blue-700"
            >
              Start
            </a>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className={`${dark ? 'bg-red-900/50' : 'bg-red-50'} px-4 py-2 text-sm text-red-500`}>
          {error}
        </div>
      )}

      {/* Calculating overlay */}
      {calculating && (
        <div className={`${dark ? 'bg-gray-800' : 'bg-white'} px-4 py-3 flex items-center gap-3 border-b ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Calculating route...</span>
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          position={userPos ? { latitude: userPos.lat, longitude: userPos.lng, heading: null, speed: null, accuracy: 10, timestamp: Date.now() } : null}
          radars={radars}
          route={route ?? undefined}
          routeRadarIds={routeRadars.map(r => r.id)}
          destination={destination ? { lat: destination.lat, lng: destination.lon, name: destination.displayName.split(',')[0] } : undefined}
        />
      </div>
    </div>
  );
}
