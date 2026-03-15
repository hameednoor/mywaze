import { Radar, GPSPosition, RadarAlert, AlertZone } from './types';
import { haversineDistance, isRadarAhead } from './geo';
import { useSettingsStore } from './settingsStore';

const BOUNDING_BOX_KM = 3;      // Only check radars within 3km
const COUNTDOWN_DISTANCE = 200;  // Beep start distance (fixed)

/** Convert km to approximate degrees for bounding box filter */
function kmToDeg(km: number): number {
  return km / 111.32;
}

/** Find the closest approaching radar and its alert zone */
export function detectRadars(
  position: GPSPosition,
  radars: Radar[]
): RadarAlert | null {
  const settings = useSettingsStore.getState();
  const alertDistance = settings.alertDistance;       // Voice alert trigger (configurable)
  const awarenessDistance = alertDistance * 2;         // Awareness zone = 2x alert distance

  const degBuffer = kmToDeg(BOUNDING_BOX_KM);

  // Bounding box filter for performance
  const nearby = radars.filter(
    (r) =>
      r.status === 'ACTIVE' &&
      Math.abs(r.latitude - position.latitude) < degBuffer &&
      Math.abs(r.longitude - position.longitude) < degBuffer
  );

  let closest: RadarAlert | null = null;

  for (const radar of nearby) {
    const distance = haversineDistance(
      position.latitude,
      position.longitude,
      radar.latitude,
      radar.longitude
    );

    // Only alert for radars ahead of us
    if (!isRadarAhead(
      position.latitude, position.longitude, position.heading,
      radar.latitude, radar.longitude
    )) {
      continue;
    }

    if (distance > awarenessDistance) continue;

    let zone: AlertZone = 'none';
    if (distance <= COUNTDOWN_DISTANCE) zone = 'countdown';
    else if (distance <= alertDistance) zone = 'alert';
    else if (distance <= awarenessDistance) zone = 'awareness';

    if (!closest || distance < closest.distance) {
      closest = { radar, distance, zone };
    }
  }

  return closest;
}

/** Find the next radar ahead on the same road after passing one */
export function findNextRadarOnRoad(
  position: GPSPosition,
  radars: Radar[],
  passedRadar: Radar
): { radar: Radar; distance: number } | null {
  const roadName = passedRadar.roadName?.trim();
  if (!roadName) return null;

  let closest: { radar: Radar; distance: number } | null = null;

  for (const radar of radars) {
    if (radar.status !== 'ACTIVE') continue;
    if (radar.id === passedRadar.id) continue;
    // Same road only
    if (radar.roadName?.trim() !== roadName) continue;

    // Must be ahead
    if (!isRadarAhead(
      position.latitude, position.longitude, position.heading,
      radar.latitude, radar.longitude
    )) continue;

    const dist = haversineDistance(
      position.latitude, position.longitude,
      radar.latitude, radar.longitude
    );

    if (!closest || dist < closest.distance) {
      closest = { radar, distance: dist };
    }
  }

  return closest;
}
