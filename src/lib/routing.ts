import { Radar } from './types';
import { haversineDistance } from './geo';

export interface SearchResult {
  displayName: string;
  lat: number;
  lon: number;
}

export interface RouteData {
  coordinates: [number, number][]; // [lng, lat] pairs
  distanceKm: number;
  durationMin: number;
  geometry: GeoJSON.LineString;
}

/** Search for places using Nominatim (OpenStreetMap geocoding) */
export async function searchPlaces(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ae&limit=8`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MyWaze/1.0' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((item: { display_name: string; lat: string; lon: string }) => ({
    displayName: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }));
}

/** Get route from OSRM (Open Source Routing Machine) */
export async function getRoute(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<RouteData | null> {
  return getRouteWithWaypoints(startLat, startLng, [{ lat: endLat, lng: endLng }]);
}

/** Get route with multiple waypoints via OSRM */
export async function getRouteWithWaypoints(
  startLat: number,
  startLng: number,
  waypoints: { lat: number; lng: number }[]
): Promise<RouteData | null> {
  if (waypoints.length === 0) return null;

  // Build coordinate string: start;wp1;wp2;...;wpN
  const points = [`${startLng},${startLat}`, ...waypoints.map(w => `${w.lng},${w.lat}`)];
  const url = `https://router.project-osrm.org/route/v1/driving/${points.join(';')}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const geometry = route.geometry as GeoJSON.LineString;

    return {
      coordinates: geometry.coordinates as [number, number][],
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      geometry,
    };
  } catch {
    return null;
  }
}

/** Find radars within a given distance of a route polyline */
export function findRadarsAlongRoute(
  route: RouteData,
  radars: Radar[],
  maxDistanceM: number = 200
): Radar[] {
  const activeRadars = radars.filter((r) => r.status === 'ACTIVE');
  const routeRadars: Radar[] = [];

  for (const radar of activeRadars) {
    // Check distance from radar to each segment of the route
    for (const coord of route.coordinates) {
      const dist = haversineDistance(radar.latitude, radar.longitude, coord[1], coord[0]);
      if (dist <= maxDistanceM) {
        routeRadars.push(radar);
        break;
      }
    }
  }

  return routeRadars;
}

/** Minimum distance in meters from a point to a route polyline */
export function distanceToRoute(lat: number, lng: number, route: RouteData): number {
  let minDist = Infinity;
  for (const coord of route.coordinates) {
    const dist = haversineDistance(lat, lng, coord[1], coord[0]);
    if (dist < minDist) minDist = dist;
    if (dist < 10) return dist; // Close enough, skip rest
  }
  return minDist;
}

/** Reverse geocode a coordinate to get an address */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MyWaze/1.0' },
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.display_name || '';
  } catch {
    return '';
  }
}
