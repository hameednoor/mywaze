import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const OSM_QUERY = `[out:json][timeout:120];(node["enforcement"="maxspeed"](23.0,51.0,26.5,56.5);node["highway"="speed_camera"](23.0,51.0,26.5,56.5););out body;`;

function getEmirate(lat: number, lon: number): string {
  if (lon > 56.0) return 'Fujairah';
  if (lat > 25.85 && lon > 55.9) return 'Fujairah';
  if (lat > 25.55 && lon < 56.0) return 'Ras Al Khaimah';
  if (lat > 25.45 && lat <= 25.55) return 'Umm Al Quwain';
  if (lat > 25.38 && lat <= 25.45 && lon > 55.35) return 'Ajman';
  if (lat > 25.24 && lat <= 25.38 && lon > 55.30) return 'Sharjah';
  if (lat > 25.28 && lon > 55.45 && lon < 56.0) return 'Sharjah';
  if (lat > 24.75 && lat <= 25.35 && lon >= 54.90 && lon <= 55.65) return 'Dubai';
  return 'Abu Dhabi';
}

function getSpeedLimit(tags: Record<string, string>): number {
  if (tags.maxspeed) {
    const s = parseInt(tags.maxspeed);
    if (s > 0) return s;
  }
  return 0;
}

function isInWater(lat: number, lon: number): boolean {
  if (lon < 51.5) return true;
  if (lat < 22.5) return true;
  if (lat > 26.3) return true;
  return false;
}

// Speed limit corridors for radars without OSM speed data
const corridors = [
  { name: 'E11', speed: 140, width: 0.8, points: [[24.4539,54.6543],[24.42,54.9],[24.5,55],[24.7,55.05],[24.85,55.08],[24.95,55.1],[25,55.12]] },
  { name: 'E11', speed: 120, width: 0.6, points: [[25,55.12],[25.05,55.15],[25.08,55.17],[25.1,55.18],[25.12,55.19],[25.18,55.24],[25.21,55.27],[25.25,55.31]] },
  { name: 'E11', speed: 100, width: 0.6, points: [[25.25,55.31],[25.3,55.36],[25.35,55.4],[25.4,55.44],[25.45,55.47]] },
  { name: 'E11', speed: 120, width: 0.8, points: [[25.45,55.47],[25.55,55.52],[25.65,55.52],[25.75,55.5],[25.8,55.49]] },
  { name: 'E311', speed: 140, width: 0.8, points: [[24.2,55.75],[24.4,55.6],[24.7,55.45],[24.95,55.38]] },
  { name: 'E311', speed: 120, width: 0.6, points: [[24.95,55.38],[25.05,55.35],[25.15,55.3],[25.25,55.32],[25.35,55.4],[25.45,55.43],[25.55,55.4],[25.6,55.39]] },
  { name: 'E611', speed: 120, width: 0.8, points: [[24.98,55.15],[25.03,55.25],[25.08,55.35],[25.12,55.45],[25.2,55.6]] },
  { name: 'E44', speed: 120, width: 0.8, points: [[25.15,55.4],[25.1,55.7],[25.04,56],[24.8,56.13]] },
  { name: 'E66', speed: 120, width: 0.8, points: [[25.18,55.35],[25,55.6],[24.75,55.75],[24.22,55.77]] },
  { name: 'E88', speed: 120, width: 0.8, points: [[25.31,55.45],[25.35,55.7],[25.3,55.95],[25.13,56.33]] },
  { name: 'E22', speed: 160, width: 0.8, points: [[24.35,54.6],[24.25,55],[24.2,55.3],[24.22,55.77]] },
  { name: 'E10', speed: 120, width: 0.8, points: [[24.52,54.62],[24.66,54.55]] },
  { name: 'E11 West', speed: 140, width: 1.0, points: [[24.4539,54.6543],[24.35,54.5],[24.15,54.45],[23.9,54.41],[23.6,54.4]] },
];

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx, cy = ay + t * dy;
  const dlat = (px - cx) * 111.32;
  const dlon = (py - cy) * 111.32 * Math.cos(px * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlon * dlon);
}

function distToPolyline(lat: number, lon: number, points: number[][]): number {
  let minDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const d = distToSegment(lat, lon, points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function assignSpeedLimit(lat: number, lon: number, emirate: string): number {
  for (const c of corridors) {
    const d = distToPolyline(lat, lon, c.points);
    if (d < c.width) return c.speed;
  }
  // Fallback by distance to city center
  const centers: Record<string, [number, number]> = {
    'Abu Dhabi': [24.4539, 54.3773], 'Dubai': [25.2048, 55.2708],
    'Sharjah': [25.3463, 55.4209], 'Ajman': [25.4052, 55.4478],
    'Umm Al Quwain': [25.5647, 55.5554], 'Ras Al Khaimah': [25.7895, 55.9432],
    'Fujairah': [25.1288, 56.3265],
  };
  const center = centers[emirate] || [25.2, 55.3];
  const distKm = Math.sqrt(
    Math.pow((lat - center[0]) * 111.32, 2) +
    Math.pow((lon - center[1]) * 111.32 * Math.cos(lat * Math.PI / 180), 2)
  );
  if (distKm < 8) return 80;
  if (distKm < 20) return 100;
  return 120;
}

// Normalize non-standard speeds to UAE posted limits
const speedMap: Record<number, number> = { 10: 60, 20: 60, 30: 60, 50: 60, 70: 80, 90: 100, 110: 120, 130: 140 };

interface OSMElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

// GET triggers the refresh (Vercel cron calls GET)
export async function GET(request: Request) {
  // Verify cron secret if set (optional security)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch fresh data from OSM
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: 'data=' + encodeURIComponent(OSM_QUERY),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `OSM fetch failed: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const elements: OSMElement[] = data.elements;

    // 2. Convert to radar format, dedup, filter
    const seen = new Set<string>();
    const newRadars: {
      id: string; latitude: number; longitude: number; road_name: string;
      emirate: string; direction: string; speed_limit: number; radar_type: string;
      status: string; heading_degrees: number; last_verified: string | null; notes: string;
      source: string;
    }[] = [];

    for (const el of elements) {
      if (el.type !== 'node') continue;
      if (isInWater(el.lat, el.lon)) continue;

      const key = Math.round(el.lat * 10000) + ',' + Math.round(el.lon * 10000);
      if (seen.has(key)) continue;
      seen.add(key);

      const tags = el.tags || {};
      let speedLimit = getSpeedLimit(tags);
      const emirate = getEmirate(el.lat, el.lon);

      if (speedLimit === 0) {
        speedLimit = assignSpeedLimit(el.lat, el.lon, emirate);
      }
      if (speedMap[speedLimit] !== undefined) {
        speedLimit = speedMap[speedLimit];
      }

      newRadars.push({
        id: 'r' + el.id,
        latitude: el.lat,
        longitude: el.lon,
        road_name: tags.name || tags['name:en'] || '',
        emirate,
        direction: 'REAR_FACING',
        speed_limit: speedLimit,
        radar_type: 'FIXED',
        status: 'ACTIVE',
        heading_degrees: 0,
        last_verified: null,
        notes: '',
        source: 'osm',
      });
    }

    // 3. Get existing radar IDs from Supabase (to preserve manually added/edited radars)
    const existingIds = new Set<string>();
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: rows } = await supabase
        .from('radars')
        .select('id, direction, speed_limit, heading_degrees, road_name, notes')
        .range(from, from + pageSize - 1);
      if (!rows || rows.length === 0) break;
      for (const row of rows) existingIds.add(row.id);
      if (rows.length < pageSize) break;
      from += pageSize;
    }

    // 4. Find truly new radars (OSM IDs not already in DB)
    const toInsert = newRadars.filter(r => !existingIds.has(r.id));

    // 5. Insert new radars in batches
    let inserted = 0;
    const batchSize = 500;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { error } = await supabase.from('radars').insert(batch);
      if (error) {
        return NextResponse.json({
          error: error.message,
          osmTotal: newRadars.length,
          existingCount: existingIds.size,
          inserted,
        }, { status: 500 });
      }
      inserted += batch.length;
    }

    return NextResponse.json({
      success: true,
      osmTotal: newRadars.length,
      existingCount: existingIds.size,
      newRadarsAdded: inserted,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
