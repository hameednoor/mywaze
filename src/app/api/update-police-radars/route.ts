import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface PoliceRadar {
  lat: number;
  lon: number;
  emirate: string;
  speedLimit: number;
}

interface DBRadar {
  id: string;
  latitude: number;
  longitude: number;
}

// Speed limit corridors (same as in refresh-radars)
const corridors = [
  { speed: 140, width: 0.8, points: [[24.4539,54.6543],[24.42,54.9],[24.5,55],[24.7,55.05],[24.85,55.08],[24.95,55.1],[25,55.12]] },
  { speed: 120, width: 0.6, points: [[25,55.12],[25.05,55.15],[25.08,55.17],[25.1,55.18],[25.12,55.19],[25.18,55.24],[25.21,55.27],[25.25,55.31]] },
  { speed: 100, width: 0.6, points: [[25.25,55.31],[25.3,55.36],[25.35,55.4],[25.4,55.44],[25.45,55.47]] },
  { speed: 120, width: 0.8, points: [[25.45,55.47],[25.55,55.52],[25.65,55.52],[25.75,55.5],[25.8,55.49]] },
  { speed: 140, width: 0.8, points: [[24.2,55.75],[24.4,55.6],[24.7,55.45],[24.95,55.38]] },
  { speed: 120, width: 0.6, points: [[24.95,55.38],[25.05,55.35],[25.15,55.3],[25.25,55.32],[25.35,55.4],[25.45,55.43],[25.55,55.4],[25.6,55.39]] },
  { speed: 120, width: 0.8, points: [[24.98,55.15],[25.03,55.25],[25.08,55.35],[25.12,55.45],[25.2,55.6]] },
  { speed: 120, width: 0.8, points: [[25.15,55.4],[25.1,55.7],[25.04,56],[24.8,56.13]] },
  { speed: 120, width: 0.8, points: [[25.18,55.35],[25,55.6],[24.75,55.75],[24.22,55.77]] },
  { speed: 120, width: 0.8, points: [[25.31,55.45],[25.35,55.7],[25.3,55.95],[25.13,56.33]] },
  { speed: 160, width: 0.8, points: [[24.35,54.6],[24.25,55],[24.2,55.3],[24.22,55.77]] },
  { speed: 140, width: 1.0, points: [[24.4539,54.6543],[24.35,54.5],[24.15,54.45],[23.9,54.41],[23.6,54.4]] },
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

function assignSpeedLimit(lat: number, lon: number, emirate: string): number {
  for (const c of corridors) {
    let minDist = Infinity;
    for (let i = 0; i < c.points.length - 1; i++) {
      const d = distToSegment(lat, lon, c.points[i][0], c.points[i][1], c.points[i + 1][0], c.points[i + 1][1]);
      if (d < minDist) minDist = d;
    }
    if (minDist < c.width) return c.speed;
  }
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

/** Haversine distance in meters */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// POST /api/update-police-radars — fetch from source and merge into DB
export async function POST() {
  try {
    // 1. Fetch police radar data from gps-data-team.com
    const policeRadars: PoliceRadar[] = [];
    const seen = new Set<string>();
    let emptyPages = 0;

    for (let offset = 0; offset < 1200; offset += 15) {
      try {
        const url = `https://www.gps-data-team.com/poi/uae/safety/index.php?poi_data=safety&file=SpeedCam-AE&navigation=${offset}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadarApp/1.0)' },
        });
        if (!res.ok) { emptyPages++; if (emptyPages >= 3) break; continue; }
        const html = await res.text();

        const regex = /lat=([\d.]+)&(?:amp;)?lon=([\d.]+)/g;
        let match;
        let found = 0;
        while ((match = regex.exec(html)) !== null) {
          const lat = parseFloat(match[1]);
          const lon = parseFloat(match[2]);
          if (lat >= 22.5 && lat <= 26.5 && lon >= 51.0 && lon <= 56.5) {
            const key = Math.round(lat * 10000) + ',' + Math.round(lon * 10000);
            if (!seen.has(key)) {
              seen.add(key);
              const emirate = getEmirate(lat, lon);
              policeRadars.push({ lat, lon, emirate, speedLimit: assignSpeedLimit(lat, lon, emirate) });
              found++;
            }
          }
        }

        if (found === 0) { emptyPages++; if (emptyPages >= 3) break; } else { emptyPages = 0; }

        // Brief delay between requests
        await new Promise(r => setTimeout(r, 300));
      } catch {
        emptyPages++;
        if (emptyPages >= 3) break;
      }
    }

    // 2. Get all existing radars from Supabase
    const existingRadars: DBRadar[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data } = await supabase
        .from('radars')
        .select('id, latitude, longitude')
        .range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      existingRadars.push(...(data as DBRadar[]));
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // 3. Compare police radars against existing:
    //    - Exact match (<5m): skip (already correct)
    //    - Close match (5-200m): correct position to police record (police = truth)
    //    - No match (>200m): add as new radar
    const newRadars = [];
    const corrections: { id: string; latitude: number; longitude: number }[] = [];
    let exactCount = 0;

    for (const pr of policeRadars) {
      let bestMatch: DBRadar | null = null;
      let bestDist = Infinity;

      for (const er of existingRadars) {
        const dist = haversine(pr.lat, pr.lon, er.latitude, er.longitude);
        if (dist < bestDist) {
          bestDist = dist;
          bestMatch = er;
        }
      }

      if (bestDist < 5) {
        // Exact match — already correct
        exactCount++;
      } else if (bestDist < 200 && bestMatch) {
        // Close match — correct position to police record
        corrections.push({
          id: bestMatch.id,
          latitude: pr.lat,
          longitude: pr.lon,
        });
      } else {
        // No match — add as new
        const id: string = `pol_${Date.now()}_${newRadars.length}`;
        newRadars.push({
          id,
          latitude: pr.lat,
          longitude: pr.lon,
          road_name: '',
          emirate: pr.emirate,
          direction: 'REAR_FACING',
          speed_limit: pr.speedLimit,
          radar_type: 'FIXED',
          status: 'ACTIVE',
          heading_degrees: 0,
          last_verified: null,
          notes: 'police_record',
        });
      }
    }

    // 4. Apply corrections (update existing radar positions to match police records)
    let corrected = 0;
    for (const c of corrections) {
      const { error } = await supabase
        .from('radars')
        .update({ latitude: c.latitude, longitude: c.longitude })
        .eq('id', c.id);
      if (!error) corrected++;
    }

    // 5. Insert new radars in batches
    let inserted = 0;
    const batchSize = 500;
    for (let i = 0; i < newRadars.length; i += batchSize) {
      const batch = newRadars.slice(i, i + batchSize);
      const { error } = await supabase.from('radars').insert(batch);
      if (error) {
        return NextResponse.json({
          error: error.message,
          policeTotal: policeRadars.length,
          existingCount: existingRadars.length,
          exactMatch: exactCount,
          corrected,
          inserted,
        }, { status: 500 });
      }
      inserted += batch.length;
    }

    return NextResponse.json({
      success: true,
      policeTotal: policeRadars.length,
      existingCount: existingRadars.length,
      exactMatch: exactCount,
      positionsCorrected: corrected,
      newRadarsAdded: inserted,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

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
