export interface CustomPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  addedAt: string;
}

/** Parse coordinates from a Google Maps link or raw lat,lng text */
export function parseGoogleMapsInput(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();

  // Pattern 1: Google Maps short link with @lat,lng
  // https://www.google.com/maps/place/.../@25.1234,55.5678,17z/...
  const atMatch = trimmed.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // Pattern 2: Google Maps link with ?q=lat,lng or &ll=lat,lng
  const qMatch = trimmed.match(/[?&](?:q|ll|center)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // Pattern 3: Google Maps link with /dir/lat,lng or place/lat,lng
  const dirMatch = trimmed.match(/\/(?:dir|place)\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (dirMatch) {
    return { lat: parseFloat(dirMatch[1]), lng: parseFloat(dirMatch[2]) };
  }

  // Pattern 4: Google Maps link with !3d lat !4d lng (embedded/shortened)
  const embMatch = trimmed.match(/!3d(-?\d+\.?\d*).*!4d(-?\d+\.?\d*)/);
  if (embMatch) {
    return { lat: parseFloat(embMatch[1]), lng: parseFloat(embMatch[2]) };
  }

  // Pattern 5: maps.app.goo.gl or goo.gl short links — can't extract coords without following redirect
  // We'll handle these by trying to fetch and follow redirect
  if (trimmed.includes('goo.gl') || trimmed.includes('maps.app')) {
    return null; // Will need special handling
  }

  // Pattern 6: Raw coordinates "lat, lng" or "lat lng"
  const rawMatch = trimmed.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if (rawMatch) {
    return { lat: parseFloat(rawMatch[1]), lng: parseFloat(rawMatch[2]) };
  }

  // Pattern 7: "lng, lat" — detect if first number looks like longitude (> 40 for UAE area)
  // UAE: lat ~22-26, lng ~51-56.5
  if (rawMatch) {
    const a = parseFloat(rawMatch[1]);
    const b = parseFloat(rawMatch[2]);
    if (a > 40 && b < 40) {
      return { lat: b, lng: a };
    }
  }

  return null;
}

/** Validate that coordinates are within UAE bounds */
export function isInUAE(lat: number, lng: number): boolean {
  return lat >= 22.5 && lat <= 26.5 && lng >= 51.0 && lng <= 56.5;
}
