'use client';

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Radar, GPSPosition } from '@/lib/types';

interface MapProps {
  position: GPSPosition | null;
  radars: Radar[];
  onMapReady?: (map: maplibregl.Map) => void;
}

const RADARS_SOURCE = 'radars-source';
const RADARS_LAYER = 'radars-layer';
const RADARS_BORDER_LAYER = 'radars-border-layer';

export default function MapView({ position, radars, onMapReady }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const followUserRef = useRef(true);
  const mapReadyRef = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      center: [55.2708, 25.2048],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right'
    );

    map.on('dragstart', () => { followUserRef.current = false; });

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

    map.on('load', () => {
      // Add GeoJSON source for radars
      map.addSource(RADARS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // White border ring (rendered behind the fill)
      map.addLayer({
        id: RADARS_BORDER_LAYER,
        type: 'circle',
        source: RADARS_SOURCE,
        paint: {
          'circle-radius': 9,
          'circle-color': '#FFFFFF',
          'circle-opacity': 1,
        },
      });

      // Colored fill — red for front-facing, green for rear-facing
      map.addLayer({
        id: RADARS_LAYER,
        type: 'circle',
        source: RADARS_SOURCE,
        paint: {
          'circle-radius': 7,
          'circle-color': ['case',
            ['==', ['get', 'direction'], 'FRONT_FACING'], '#EF4444',
            '#22C55E'
          ],
          'circle-opacity': 1,
        },
      });

      mapReadyRef.current = true;
    });

    mapRef.current = map;
    onMapReady?.(map);

    return () => {
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update user position marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.innerHTML = `
        <div style="
          width: 20px; height: 20px;
          background: #2563EB;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(37,99,235,0.5);
        "></div>
      `;
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([position.longitude, position.latitude])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([position.longitude, position.latitude]);
    }

    if (followUserRef.current) {
      map.easeTo({
        center: [position.longitude, position.latitude],
        duration: 500,
      });
    }
  }, [position]);

  // Update radar data on the GeoJSON source
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const source = map.getSource(RADARS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const features = radars
      .filter((r) => r.status === 'ACTIVE')
      .map((r) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [r.longitude, r.latitude],
        },
        properties: {
          id: r.id,
          direction: r.direction,
          speedLimit: r.speedLimit,
          roadName: r.roadName || 'Radar',
        },
      }));

    source.setData({ type: 'FeatureCollection', features });
  }, [radars]);

  const recenter = useCallback(() => {
    if (mapRef.current && position) {
      followUserRef.current = true;
      mapRef.current.flyTo({
        center: [position.longitude, position.latitude],
        zoom: 15,
        duration: 1000,
      });
    }
  }, [position]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      {/* Recenter button */}
      <button
        onClick={recenter}
        className="absolute right-3 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center active:bg-gray-100 z-10"
        style={{ bottom: 'max(96px, calc(env(safe-area-inset-bottom, 0px) + 96px))' }}
        title="Re-center"
      >
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M2 12h2m16 0h2" />
        </svg>
      </button>
    </div>
  );
}
