'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRadarStore } from '@/lib/radarStore';
import { useSettingsStore } from '@/lib/settingsStore';
import { searchPlaces, getRouteWithWaypoints, findRadarsAlongRoute, SearchResult, RouteData } from '@/lib/routing';
import { Radar } from '@/lib/types';
import { useCustomPlacesStore } from '@/lib/customPlacesStore';

const MapView = dynamic(() => import('@/components/Map'), { ssr: false });

interface Waypoint {
  label: string;
  query: string;
  result: SearchResult | null;
}

export default function NavigatePage() {
  const { radars, loadRadars } = useRadarStore();
  const { isDark, loadSettings } = useSettingsStore();
  const { places: customPlaces, loadPlaces: loadCustomPlaces } = useCustomPlacesStore();
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { label: '1st Destination', query: '', result: null },
  ]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeRadars, setRouteRadars] = useState<Radar[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dark = isDark();

  useEffect(() => {
    loadRadars();
    loadSettings();
    loadCustomPlaces();
  }, [loadRadars, loadSettings, loadCustomPlaces]);

  // Get current position once
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Debounced search
  const handleSearch = useCallback((q: string, index: number) => {
    // Update waypoint query
    setWaypoints(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], query: q, result: null };
      return updated;
    });
    setActiveIndex(index);
    setError('');
    setRoute(null);
    setRouteRadars([]);

    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        // Search custom places first (instant, local)
        const qLower = q.toLowerCase();
        const customMatches: SearchResult[] = customPlaces
          .filter(p => p.name.toLowerCase().includes(qLower))
          .map(p => ({ displayName: p.name, lat: p.latitude, lon: p.longitude }));

        // Then search OSM
        const osmResults = await searchPlaces(q);

        // Custom places first, then OSM results
        setResults([...customMatches, ...osmResults]);
      } catch {
        // Still show custom matches on network error
        const qLower = q.toLowerCase();
        const customMatches: SearchResult[] = customPlaces
          .filter(p => p.name.toLowerCase().includes(qLower))
          .map(p => ({ displayName: p.name, lat: p.latitude, lon: p.longitude }));
        setResults(customMatches);
      }
      setSearching(false);
    }, 400);
  }, []);

  function selectResult(result: SearchResult, index: number) {
    setWaypoints(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], query: result.displayName.split(',')[0], result };
      return updated;
    });
    setResults([]);
    setActiveIndex(null);
  }

  function addWaypoint() {
    if (waypoints.length >= 3) return;
    const labels = ['1st Destination', '2nd Destination', '3rd Destination'];
    setWaypoints(prev => [...prev, { label: labels[prev.length], query: '', result: null }]);
  }

  function removeWaypoint(index: number) {
    if (waypoints.length <= 1) return;
    setWaypoints(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Re-label
      const labels = ['1st Destination', '2nd Destination', '3rd Destination'];
      return updated.map((w, i) => ({ ...w, label: labels[i] }));
    });
    setRoute(null);
    setRouteRadars([]);
  }

  async function calculateRoute() {
    const filledWaypoints = waypoints.filter(w => w.result !== null);
    if (filledWaypoints.length === 0) {
      setError('Enter at least one destination');
      return;
    }
    if (!userPos) {
      setError('Waiting for GPS location...');
      return;
    }

    setCalculating(true);
    setError('');

    const points = filledWaypoints.map(w => ({ lat: w.result!.lat, lng: w.result!.lon }));
    const routeData = await getRouteWithWaypoints(userPos.lat, userPos.lng, points);

    if (routeData) {
      setRoute(routeData);
      const radarsOnRoute = findRadarsAlongRoute(routeData, radars);
      setRouteRadars(radarsOnRoute);
    } else {
      setError('Could not calculate route');
    }
    setCalculating(false);
  }

  function clearAll() {
    setWaypoints([{ label: '1st Destination', query: '', result: null }]);
    setRoute(null);
    setRouteRadars([]);
    setResults([]);
    setError('');
    setActiveIndex(null);
  }

  // Last filled waypoint for destination marker on map
  const lastWaypoint = [...waypoints].reverse().find(w => w.result);

  return (
    <div className={`h-[100dvh] flex flex-col overflow-hidden ${dark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Top bar */}
      <div
        className={`${dark ? 'bg-gray-800' : 'bg-gray-900'} text-white px-4 py-3 flex-shrink-0 z-20`}
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <a href="/" className="text-blue-400 text-sm">&larr; Map</a>
          <h1 className="text-lg font-bold flex-1">Route Planner</h1>
          {(route || waypoints.some(w => w.query)) && (
            <button onClick={clearAll} className="text-red-400 text-sm font-medium">Clear</button>
          )}
        </div>

        {/* Waypoint inputs */}
        <div className="space-y-2">
          {waypoints.map((wp, i) => (
            <div key={i} className="relative">
              <div className="flex items-center gap-2">
                {/* Stop number indicator */}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  wp.result ? 'bg-blue-600 text-white' : (dark ? 'bg-gray-600 text-gray-300' : 'bg-gray-500 text-white')
                }`}>
                  {i + 1}
                </div>

                <input
                  type="text"
                  value={wp.query}
                  onChange={(e) => handleSearch(e.target.value, i)}
                  onFocus={() => setActiveIndex(i)}
                  placeholder={wp.label}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-sm ${
                    dark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-white text-gray-900 placeholder-gray-500'
                  } ${wp.result ? 'border-2 border-blue-500' : ''}`}
                />

                {/* Remove button (only if more than 1 waypoint) */}
                {waypoints.length > 1 && (
                  <button
                    onClick={() => removeWaypoint(i)}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 active:text-red-400 flex-shrink-0"
                  >
                    &times;
                  </button>
                )}
              </div>

              {/* Search results for this input */}
              {activeIndex === i && results.length > 0 && (
                <div className={`absolute left-8 right-0 mt-1 rounded-xl overflow-hidden shadow-lg max-h-[35vh] overflow-y-auto z-30 ${
                  dark ? 'bg-gray-700' : 'bg-white'
                }`}>
                  {results.map((r, ri) => (
                    <button
                      key={ri}
                      onClick={() => selectResult(r, i)}
                      className={`w-full text-left px-4 py-3 text-sm border-b last:border-b-0 transition-colors ${
                        dark
                          ? 'border-gray-600 active:bg-gray-600 text-white'
                          : 'border-gray-100 active:bg-gray-50 text-gray-900'
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
          ))}
        </div>

        {/* Add waypoint + Calculate buttons */}
        <div className="flex gap-2 mt-3">
          {waypoints.length < 3 && (
            <button
              onClick={addWaypoint}
              className={`px-3 py-2 rounded-xl text-sm font-medium ${
                dark ? 'bg-gray-700 text-gray-300 active:bg-gray-600' : 'bg-gray-700 text-white active:bg-gray-600'
              }`}
            >
              + Add Stop
            </button>
          )}
          <button
            onClick={calculateRoute}
            disabled={calculating || !waypoints.some(w => w.result)}
            className="flex-1 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium disabled:opacity-40 active:bg-blue-700"
          >
            {calculating ? 'Calculating...' : 'Calculate Route'}
          </button>
        </div>
      </div>

      {/* Route info bar */}
      {route && (
        <div className={`${dark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b px-4 py-3 flex-shrink-0 z-10`}>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {/* Show all stops */}
              <div className="flex items-center gap-1 flex-wrap">
                {waypoints.filter(w => w.result).map((w, i, arr) => (
                  <span key={i} className="text-sm">
                    <span className="font-medium">{w.query}</span>
                    {i < arr.length - 1 && <span className={`mx-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>&rarr;</span>}
                  </span>
                ))}
              </div>
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
              className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold active:bg-green-700"
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
          destination={lastWaypoint ? { lat: lastWaypoint.result!.lat, lng: lastWaypoint.result!.lon, name: lastWaypoint.query } : undefined}
        />
      </div>
    </div>
  );
}
