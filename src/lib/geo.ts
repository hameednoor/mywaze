/** Haversine distance between two lat/lng points in meters */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Calculate bearing from point 1 to point 2 in degrees (0-360) */
export function bearing(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = Math.atan2(y, x);
  return ((brng * 180) / Math.PI + 360) % 360;
}

/** Check if a radar is ahead of the user based on heading */
export function isRadarAhead(
  userLat: number, userLon: number,
  userHeading: number | null,
  radarLat: number, radarLon: number
): boolean {
  if (userHeading === null) return true; // If no heading, assume ahead
  const bearingToRadar = bearing(userLat, userLon, radarLat, radarLon);
  const diff = Math.abs(bearingToRadar - userHeading);
  const angleDiff = diff > 180 ? 360 - diff : diff;
  return angleDiff < 90; // Within 90 degrees of heading = ahead
}
