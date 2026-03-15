'use client';

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Radar, GPSPosition } from '@/lib/types';
import { RouteData } from '@/lib/routing';
import { SavedPlace } from '@/lib/placesStore';
import { useSettingsStore } from '@/lib/settingsStore';

interface MapProps {
  position: GPSPosition | null;
  radars: Radar[];
  onMapReady?: (map: maplibregl.Map) => void;
  route?: RouteData;
  routeRadarIds?: string[];
  destination?: { lat: number; lng: number; name: string };
  waypoints?: { lat: number; lng: number; name: string; index: number }[];
  savedPlaces?: SavedPlace[];
  onPlaceClick?: (place: SavedPlace) => void;
}

const RADARS_SOURCE = 'radars-source';
const RADARS_LAYER = 'radars-layer';
const RADARS_BORDER_LAYER = 'radars-border-layer';
const ROUTE_SOURCE = 'route-source';
const ROUTE_LAYER = 'route-layer';
const ROUTE_CASING_LAYER = 'route-casing-layer';
const ROUTE_RADARS_SOURCE = 'route-radars-source';
const ROUTE_RADARS_LAYER = 'route-radars-layer';
const ROUTE_RADARS_BORDER_LAYER = 'route-radars-border-layer';

const LIGHT_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export default function MapView({ position, radars, onMapReady, route, routeRadarIds, destination, waypoints, savedPlaces, onPlaceClick }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const waypointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const placeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const followUserRef = useRef(true);
  const mapReadyRef = useRef(false);
  const currentStyleRef = useRef('');

  const isDark = useSettingsStore((s) => s.isDark());

  // Determine style
  const targetStyle = isDark ? DARK_STYLE : LIGHT_STYLE;

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    currentStyleRef.current = targetStyle;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: targetStyle,
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
      addMapLayers(map);
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

  // Switch map style when dark mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || currentStyleRef.current === targetStyle) return;

    currentStyleRef.current = targetStyle;
    mapReadyRef.current = false;

    map.setStyle(targetStyle);

    map.once('style.load', () => {
      addMapLayers(map);
      mapReadyRef.current = true;
      // Re-apply radar data
      updateRadarSource(map, radars);
      // Re-apply route
      if (route) updateRouteSource(map, route);
      if (routeRadarIds) updateRouteRadarSource(map, radars, routeRadarIds);
    });
  }, [targetStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update user position marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !position) return;

    const heading = position.heading ?? 0;

    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-marker';
      el.style.cssText = 'width: 40px; height: 40px; position: relative;';
      el.innerHTML = `
        <div style="
          width: 40px; height: 40px;
          position: absolute; top: 0; left: 0;
          transform: rotate(${heading}deg);
          transition: transform 0.5s ease;
        " class="user-arrow">
          <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="arrow-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
              </filter>
            </defs>
            <polygon points="20,4 32,32 20,26 8,32" fill="#2563EB" stroke="white" stroke-width="2" stroke-linejoin="round" filter="url(#arrow-shadow)"/>
          </svg>
        </div>
        <div style="
          width: 8px; height: 8px;
          background: #2563EB;
          border: 2px solid white;
          border-radius: 50%;
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
        "></div>
      `;
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([position.longitude, position.latitude])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([position.longitude, position.latitude]);
      const arrow = userMarkerRef.current.getElement().querySelector('.user-arrow') as HTMLElement;
      if (arrow) arrow.style.transform = `rotate(${heading}deg)`;
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
    updateRadarSource(map, radars);
  }, [radars]);

  // Update route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    if (route) {
      updateRouteSource(map, route);
      // Fit bounds to route
      const coords = route.coordinates;
      if (coords.length > 0) {
        const bounds = new maplibregl.LngLatBounds(coords[0], coords[0]);
        for (const c of coords) bounds.extend(c as [number, number]);
        map.fitBounds(bounds, { padding: 60, duration: 1000 });
        followUserRef.current = false;
      }
    } else {
      // Clear route
      const src = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [route]);

  // Update route radars highlight
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;
    updateRouteRadarSource(map, radars, routeRadarIds || []);
  }, [routeRadarIds, radars]);

  // Destination marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

    if (destination) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          width: 32px; height: 32px;
          background: #EF4444;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="width: 10px; height: 10px; background: white; border-radius: 50%; transform: rotate(45deg);"></div>
        </div>
      `;
      destMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom-left' })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map);
    }
  }, [destination]);

  // Waypoint markers (numbered stops)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old waypoint markers
    waypointMarkersRef.current.forEach((m) => m.remove());
    waypointMarkersRef.current = [];

    if (!waypoints || waypoints.length === 0) return;

    const colors = ['#3B82F6', '#8B5CF6', '#F59E0B'];

    for (const wp of waypoints) {
      const color = colors[wp.index] || colors[0];
      const num = wp.index + 1;

      const el = document.createElement('div');
      el.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="
            width: 36px; height: 36px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
          ">
            <span style="
              transform: rotate(45deg);
              color: white;
              font-size: 14px;
              font-weight: bold;
            ">${num}</span>
          </div>
          <div style="
            background: rgba(0,0,0,0.75);
            color: white;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            margin-top: 4px;
            white-space: nowrap;
            max-width: 100px;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${wp.name}</div>
        </div>
      `;

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom-left' })
        .setLngLat([wp.lng, wp.lat])
        .addTo(map);

      waypointMarkersRef.current.push(marker);
    }
  }, [waypoints]);

  // Saved places markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    placeMarkersRef.current.forEach((m) => m.remove());
    placeMarkersRef.current = [];

    if (!savedPlaces) return;

    for (const place of savedPlaces) {
      const color = place.type === 'home' ? '#22C55E' : place.type === 'work' ? '#3B82F6' : '#EAB308';
      const icon = place.type === 'home' ? 'H' : place.type === 'work' ? 'W' : '★';

      const el = document.createElement('div');
      el.style.cssText = 'cursor: pointer;';
      el.innerHTML = `
        <div style="
          display: flex; flex-direction: column; align-items: center;
        ">
          <div style="
            width: 24px; height: 24px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 11px; font-weight: bold;
          ">${icon}</div>
          <div style="
            background: rgba(0,0,0,0.7);
            color: white;
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 3px;
            margin-top: 2px;
            white-space: nowrap;
            max-width: 80px;
            overflow: hidden;
            text-overflow: ellipsis;
          ">${place.name}</div>
        </div>
      `;

      if (onPlaceClick) {
        el.addEventListener('click', () => onPlaceClick(place));
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);

      placeMarkersRef.current.push(marker);
    }
  }, [savedPlaces, onPlaceClick]);

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

/** Add all custom sources and layers to the map */
function addMapLayers(map: maplibregl.Map) {
  // Route casing + line
  map.addSource(ROUTE_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: ROUTE_CASING_LAYER,
    type: 'line',
    source: ROUTE_SOURCE,
    paint: {
      'line-color': '#1E40AF',
      'line-width': 8,
      'line-opacity': 0.4,
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
  });

  map.addLayer({
    id: ROUTE_LAYER,
    type: 'line',
    source: ROUTE_SOURCE,
    paint: {
      'line-color': '#3B82F6',
      'line-width': 5,
      'line-opacity': 0.9,
    },
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
    },
  });

  // Radars
  map.addSource(RADARS_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

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

  map.addLayer({
    id: RADARS_LAYER,
    type: 'circle',
    source: RADARS_SOURCE,
    paint: {
      'circle-radius': 7,
      'circle-color': ['case',
        ['==', ['get', 'direction'], 'FRONT_FACING'], '#22C55E',
        '#EF4444'
      ],
      'circle-opacity': 1,
    },
  });


  // Route radar highlights (bigger, pulsing)
  map.addSource(ROUTE_RADARS_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: ROUTE_RADARS_BORDER_LAYER,
    type: 'circle',
    source: ROUTE_RADARS_SOURCE,
    paint: {
      'circle-radius': 14,
      'circle-color': '#FBBF24',
      'circle-opacity': 0.5,
    },
  });

  map.addLayer({
    id: ROUTE_RADARS_LAYER,
    type: 'circle',
    source: ROUTE_RADARS_SOURCE,
    paint: {
      'circle-radius': 10,
      'circle-color': '#EF4444',
      'circle-opacity': 1,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#FBBF24',
    },
  });

  // UAE highway shields placed along real road geometry
  addHighwayShields(map);
}

/** Create UAE-style highway shield image (blue rounded rect, white text) */
function createShieldImage(map: maplibregl.Map, name: string): string {
  const imageId = `shield-${name}`;
  if (map.hasImage(imageId)) return imageId;

  const scale = 2;
  const fontSize = 13 * scale;
  const padX = 8 * scale;
  const padY = 5 * scale;
  const radius = 4 * scale;
  const borderW = 1.5 * scale;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  measureCtx.font = `bold ${fontSize}px Arial, sans-serif`;
  const textWidth = measureCtx.measureText(name).width;

  const w = Math.ceil(textWidth + padX * 2);
  const h = Math.ceil(fontSize + padY * 2);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.beginPath();
  ctx.roundRect(borderW, borderW, w - borderW * 2, h - borderW * 2, radius);
  ctx.fillStyle = '#005BAC';
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = borderW;
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, w / 2, h / 2);

  const imageData = ctx.getImageData(0, 0, w, h);
  map.addImage(imageId, { width: w, height: h, data: new Uint8Array(imageData.data.buffer) }, { pixelRatio: scale });
  return imageId;
}

/** Add highway shield signs along real road lines */
async function addHighwayShields(map: maplibregl.Map) {
  let highways: { ref: string; segments: [number, number][][] }[];
  try {
    const mod = await import('@/data/highways.json');
    highways = mod.default as typeof highways;
  } catch { return; }

  // Create shield images
  const uniqueRefs = [...new Set(highways.map(h => h.ref))];
  for (const ref of uniqueRefs) {
    createShieldImage(map, ref);
  }

  // Build LineString features from segments
  const features = highways.flatMap(hw =>
    hw.segments.map(coords => ({
      type: 'Feature' as const,
      geometry: { type: 'LineString' as const, coordinates: coords },
      properties: { ref: hw.ref, icon: `shield-${hw.ref}` },
    }))
  );

  map.addSource('highway-shields', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features },
  });

  map.addLayer({
    id: 'highway-shields-layer',
    type: 'symbol',
    source: 'highway-shields',
    layout: {
      'symbol-placement': 'line',
      'icon-image': ['get', 'icon'],
      'icon-size': 1,
      'icon-allow-overlap': false,
      'icon-keep-upright': true,
      'symbol-spacing': 400,
      'icon-rotation-alignment': 'viewport',
    },
    minzoom: 7,
  });
}

function updateRadarSource(map: maplibregl.Map, radars: Radar[]) {
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
}


function updateRouteSource(map: maplibregl.Map, route: RouteData) {
  const source = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (!source) return;

  source.setData({
    type: 'Feature',
    geometry: route.geometry,
    properties: {},
  });
}

function updateRouteRadarSource(map: maplibregl.Map, radars: Radar[], routeRadarIds: string[]) {
  const source = map.getSource(ROUTE_RADARS_SOURCE) as maplibregl.GeoJSONSource | undefined;
  if (!source) return;

  if (!routeRadarIds.length) {
    source.setData({ type: 'FeatureCollection', features: [] });
    return;
  }

  const idSet = new Set(routeRadarIds);
  const features = radars
    .filter((r) => idSet.has(r.id))
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
      },
    }));

  source.setData({ type: 'FeatureCollection', features });
}
