import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function toRad(deg: number) { return deg * Math.PI / 180; }
function toDeg(rad: number) { return rad * 180 / Math.PI; }

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

async function getRoadBearing(lat: number, lon: number): Promise<number | null> {
  try {
    // Get nearest point on road
    const nearestRes = await fetch(
      `https://router.project-osrm.org/nearest/v1/driving/${lon},${lat}?number=1`
    );
    if (!nearestRes.ok) return null;
    const nearestData = await nearestRes.json();
    if (!nearestData.waypoints?.[0]) return null;

    const snappedLon = nearestData.waypoints[0].location[0];
    const snappedLat = nearestData.waypoints[0].location[1];
    const roadName = nearestData.waypoints[0].name || '';

    // Route a short distance to get road direction
    const routeRes = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${snappedLon},${snappedLat};${snappedLon + 0.003},${snappedLat}?overview=full&geometries=geojson`
    );
    if (!routeRes.ok) return null;
    const routeData = await routeRes.json();
    if (!routeData.routes?.[0]?.geometry?.coordinates) return null;

    const coords = routeData.routes[0].geometry.coordinates;
    if (coords.length < 2) return null;

    // Get bearing of the first road segment near the radar
    const b = bearing(coords[0][1], coords[0][0], coords[1][1], coords[1][0]);

    // Determine which side of the road the radar is on using cross product
    const dx = coords[1][0] - coords[0][0];
    const dy = coords[1][1] - coords[0][1];
    const px = lon - coords[0][0];
    const py = lat - coords[0][1];
    const cross = dx * py - dy * px;

    // Radar on left side faces road direction, right side faces opposite
    const heading = cross >= 0 ? Math.round(b) : Math.round((b + 180) % 360);
    return heading === 0 ? 360 : heading; // avoid 0 since that means "unset"
  } catch {
    return null;
  }
}

// POST /api/fix-headings — fix all radars with heading=0 using OSRM road data
export async function POST() {
  // Fetch all radars with heading=0 or null
  const { data: radars, error } = await supabase
    .from('radars')
    .select('id, latitude, longitude, heading_degrees, road_name')
    .or('heading_degrees.is.null,heading_degrees.eq.0');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!radars || radars.length === 0) {
    return NextResponse.json({ message: 'No radars need fixing', fixed: 0, failed: 0 });
  }

  let fixed = 0;
  let failed = 0;
  const updates: { id: string; heading: number }[] = [];

  for (let i = 0; i < radars.length; i++) {
    const radar = radars[i];
    const heading = await getRoadBearing(radar.latitude, radar.longitude);

    if (heading !== null && heading !== 0) {
      updates.push({ id: radar.id, heading });
      fixed++;
    } else {
      failed++;
    }

    // Rate limit OSRM - 5 req/sec max
    await new Promise(r => setTimeout(r, 250));
  }

  // Push updates in batches
  const batchSize = 50;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    await Promise.all(
      batch.map(u =>
        supabase.from('radars').update({ heading_degrees: u.heading }).eq('id', u.id)
      )
    );
  }

  return NextResponse.json({
    message: `Fixed ${fixed} radars, ${failed} could not be determined`,
    total: radars.length,
    fixed,
    failed,
  });
}
