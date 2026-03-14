'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GPSPosition } from './types';

export function useGPS(enabled: boolean = true) {
  const [position, setPosition] = useState<GPSPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const prevPosRef = useRef<{ lat: number; lon: number; time: number } | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed, accuracy } = pos.coords;

        // Calculate heading from consecutive fixes if not provided
        let computedHeading = heading;
        if (computedHeading === null && prevPosRef.current) {
          const prev = prevPosRef.current;
          const dLat = latitude - prev.lat;
          const dLon = longitude - prev.lon;
          if (Math.abs(dLat) > 0.00001 || Math.abs(dLon) > 0.00001) {
            computedHeading =
              (Math.atan2(dLon, dLat) * 180) / Math.PI;
            if (computedHeading < 0) computedHeading += 360;
          }
        }

        prevPosRef.current = { lat: latitude, lon: longitude, time: pos.timestamp };

        setPosition({
          latitude,
          longitude,
          heading: computedHeading,
          speed,
          accuracy,
          timestamp: pos.timestamp,
        });
        setError(null);
      },
      (err) => {
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled]);

  return { position, error };
}
