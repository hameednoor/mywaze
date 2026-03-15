'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Radar } from '@/lib/types';
import { useSettingsStore } from '@/lib/settingsStore';
import { useRouteStore } from '@/lib/routeStore';

interface Props {
  radars: Radar[];
  selectedId: string | null;
  addMode?: boolean;
  onRadarClick: (radar: Radar) => void;
  onMapClick: (lat: number, lng: number) => void;
  onRadarMove?: (radar: Radar, lat: number, lng: number) => void;
}

export default function AdminMap({ radars, selectedId, addMode, onRadarClick, onMapClick, onRadarMove }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const followUserRef = useRef(false);
  const radarsRef = useRef(radars);
  const onRadarClickRef = useRef(onRadarClick);
  const onRadarMoveRef = useRef(onRadarMove);
  const addModeRef = useRef(addMode);
  const currentStyleRef = useRef('');
  const [tracking, setTracking] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  const isDark = useSettingsStore((s) => s.isDark());
  const { route, loadFromStorage } = useRouteStore();

  useEffect(() => { loadFromStorage(); }, [loadFromStorage]);

  radarsRef.current = radars;
  onRadarClickRef.current = onRadarClick;
  onRadarMoveRef.current = onRadarMove;
  addModeRef.current = addMode;

  const mapStyle = isDark
    ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
    : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    currentStyleRef.current = mapStyle;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [55.2708, 25.2048],
      zoom: 10,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Force all labels to English
    map.on('styledata', () => {
      const style = map.getStyle();
      if (!style || !style.layers) return;
      for (const layer of style.layers) {
        if (layer.type === 'symbol' && layer.layout && layer.layout['text-field']) {
          map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name_en'], ['get', 'name:en'], ['get', 'name']]);
        }
      }
    });

    // Stop following when user drags
    map.on('dragstart', () => { followUserRef.current = false; });

    // Right-click to add radar
    map.on('contextmenu', (e) => {
      onMapClick(e.lngLat.lat, e.lngLat.lng);
    });

    // Left-click to add radar when in add mode
    map.on('click', (e) => {
      if (addModeRef.current) {
        onMapClick(e.lngLat.lat, e.lngLat.lng);
      }
    });

    // Route layers
    map.on('load', () => {
      map.addSource('admin-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'admin-route-casing',
        type: 'line',
        source: 'admin-route',
        paint: { 'line-color': '#1E40AF', 'line-width': 8, 'line-opacity': 0.4 },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });
      map.addLayer({
        id: 'admin-route-line',
        type: 'line',
        source: 'admin-route',
        paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 0.9 },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // GPS tracking
  useEffect(() => {
    if (!tracking) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      setUserPos(null);
      return;
    }

    if (!navigator.geolocation) return;

    followUserRef.current = true;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserPos({ lat, lng });

        const map = mapRef.current;
        if (!map) return;

        // Create or update user marker
        if (!userMarkerRef.current) {
          const el = document.createElement('div');
          el.innerHTML = `
            <div style="
              width: 22px; height: 22px;
              background: #2563EB;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 12px rgba(37,99,235,0.6);
            "></div>
          `;
          userMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map);
        } else {
          userMarkerRef.current.setLngLat([lng, lat]);
        }

        // Follow user
        if (followUserRef.current) {
          map.easeTo({ center: [lng, lat], duration: 500 });
        }
      },
      (err) => { console.warn('GPS error:', err.message); },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [tracking]);

  // Change cursor in add mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = addMode ? 'crosshair' : '';
  }, [addMode]);

  // Switch map style when dark mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || currentStyleRef.current === mapStyle) return;
    currentStyleRef.current = mapStyle;
    map.setStyle(mapStyle);
    // Re-add route layers after style loads
    map.once('styledata', () => {
      if (!map.getSource('admin-route')) {
        map.addSource('admin-route', {
          type: 'geojson',
          data: route ? { type: 'Feature', geometry: route.geometry, properties: {} } : { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'admin-route-casing',
          type: 'line',
          source: 'admin-route',
          paint: { 'line-color': '#1E40AF', 'line-width': 8, 'line-opacity': 0.4 },
          layout: { 'line-join': 'round', 'line-cap': 'round' },
        });
        map.addLayer({
          id: 'admin-route-line',
          type: 'line',
          source: 'admin-route',
          paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 0.9 },
          layout: { 'line-join': 'round', 'line-cap': 'round' },
        });
      }
    });
  }, [mapStyle, route]);

  // Update route on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource('admin-route') as maplibregl.GeoJSONSource | undefined;
    if (!source) {
      // Source not ready yet, retry after load
      const onLoad = () => {
        const s = map.getSource('admin-route') as maplibregl.GeoJSONSource | undefined;
        if (s) {
          s.setData(route ? { type: 'Feature', geometry: route.geometry, properties: {} } : { type: 'FeatureCollection', features: [] });
        }
      };
      map.once('load', onLoad);
      return;
    }
    source.setData(route ? { type: 'Feature', geometry: route.geometry, properties: {} } : { type: 'FeatureCollection', features: [] });
  }, [route]);

  // Render radar markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const radar of radars) {
      const isFront = radar.direction === 'FRONT_FACING';
      const isSelected = radar.id === selectedId;
      const color = radar.status !== 'ACTIVE'
        ? '#9CA3AF'
        : isFront ? '#00C853' : '#FF1744';
      const size = isSelected ? 24 : 18;
      const borderColor = isSelected ? '#2563EB' : 'white';

      const el = document.createElement('div');
      el.style.cssText = `
        width: ${size}px; height: ${size}px;
        cursor: pointer;
        transition: all 0.2s;
      `;
      el.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="9" fill="${color}" stroke="${borderColor}" stroke-width="2.5"/>
        </svg>
      `;
      el.title = `${radar.roadName || 'Radar'} — ${radar.speedLimit}km/h (${radar.direction})`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onRadarClickRef.current(radar);
      });

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([radar.longitude, radar.latitude])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        onRadarMoveRef.current?.(radar, lngLat.lat, lngLat.lng);
      });

      markersRef.current.push(marker);
    }
  }, [radars, selectedId]);

  // Fly to selected radar
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const radar = radars.find((r) => r.id === selectedId);
    if (radar) {
      followUserRef.current = false;
      mapRef.current.flyTo({
        center: [radar.longitude, radar.latitude],
        zoom: 15,
        duration: 800,
      });
    }
  }, [selectedId, radars]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* GPS tracking toggle */}
      <button
        onClick={() => {
          if (tracking) {
            setTracking(false);
          } else {
            setTracking(true);
          }
        }}
        className={`absolute bottom-4 left-4 z-10 px-4 py-2 rounded-full text-sm font-medium shadow-lg transition-colors ${
          tracking
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-white text-gray-700 hover:bg-gray-100'
        }`}
        title={tracking ? 'Stop tracking' : 'Start GPS tracking'}
      >
        {tracking ? 'GPS ON' : 'GPS OFF'}
      </button>

      {/* Re-center on user */}
      {tracking && userPos && (
        <button
          onClick={() => {
            followUserRef.current = true;
            mapRef.current?.flyTo({
              center: [userPos.lng, userPos.lat],
              zoom: 15,
              duration: 800,
            });
          }}
          className="absolute bottom-4 left-28 z-10 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50"
          title="Re-center on me"
        >
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M2 12h2m16 0h2" />
          </svg>
        </button>
      )}

      {/* Quick-add at current position */}
      {tracking && userPos && (
        <button
          onClick={() => onMapClick(userPos.lat, userPos.lng)}
          className="absolute bottom-4 left-40 z-10 px-4 py-2 bg-green-600 text-white rounded-full text-sm font-medium shadow-lg hover:bg-green-700"
          title="Add radar at current position"
        >
          + Add Here
        </button>
      )}
    </div>
  );
}
