import { Radar, GPSPosition, RadarAlert, AlertZone } from './types';
import { haversineDistance, isRadarAhead } from './geo';

const AWARENESS_DISTANCE = 1000; // 1km
const ALERT_DISTANCE = 500;      // Voice alert trigger
const COUNTDOWN_DISTANCE = 200;  // Beep start
const BOUNDING_BOX_KM = 2;      // Only check radars within 2km

/** Convert km to approximate degrees for bounding box filter */
function kmToDeg(km: number): number {
  return km / 111.32;
}

/** Find the closest approaching radar and its alert zone */
export function detectRadars(
  position: GPSPosition,
  radars: Radar[]
): RadarAlert | null {
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

    if (distance > AWARENESS_DISTANCE) continue;

    let zone: AlertZone = 'none';
    if (distance <= COUNTDOWN_DISTANCE) zone = 'countdown';
    else if (distance <= ALERT_DISTANCE) zone = 'alert';
    else if (distance <= AWARENESS_DISTANCE) zone = 'awareness';

    if (!closest || distance < closest.distance) {
      closest = { radar, distance, zone };
    }
  }

  return closest;
}
