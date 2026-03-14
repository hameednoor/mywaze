'use client';

import { useEffect, useRef } from 'react';
import { RadarAlert } from '@/lib/types';
import { playBeep, getBeepParams, speakRadarAlert } from '@/lib/audio';

interface Props {
  alert: RadarAlert | null;
}

export default function RadarAlertOverlay({ alert }: Props) {
  const lastVoiceRadarId = useRef<string | null>(null);
  const beepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Voice alert at 500m
  useEffect(() => {
    if (!alert || alert.zone !== 'alert') return;
    if (lastVoiceRadarId.current === alert.radar.id) return;
    lastVoiceRadarId.current = alert.radar.id;
    speakRadarAlert(alert.radar.direction, alert.radar.speedLimit);
  }, [alert]);

  // Beep system (200m to 0m)
  useEffect(() => {
    if (beepTimerRef.current) {
      clearInterval(beepTimerRef.current);
      beepTimerRef.current = null;
    }

    if (!alert || alert.zone !== 'countdown') return;

    const params = getBeepParams(alert.distance);
    if (!params) return;

    // Play immediately
    playBeep(params.frequency, params.duration);

    beepTimerRef.current = setInterval(() => {
      if (!alert) return;
      const p = getBeepParams(alert.distance);
      if (p) playBeep(p.frequency, p.duration);
    }, params.interval);

    return () => {
      if (beepTimerRef.current) {
        clearInterval(beepTimerRef.current);
        beepTimerRef.current = null;
      }
    };
  }, [alert?.zone, alert?.distance && Math.round(alert.distance / 25)]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset voice tracker when alert clears
  useEffect(() => {
    if (!alert || alert.zone === 'none') {
      lastVoiceRadarId.current = null;
    }
  }, [alert]);

  if (!alert || alert.zone === 'none' || alert.zone === 'awareness') return null;

  const isFront = alert.radar.direction === 'FRONT_FACING';
  const barColor = isFront ? '#00C853' : '#FF1744';
  const isFlashing = !isFront; // Rear-facing flashes

  return (
    <>
      {/* Left side bar */}
      <div
        className={`fixed left-0 top-0 bottom-0 z-40 pointer-events-none ${isFlashing ? 'animate-flash' : ''}`}
        style={{
          width: '12px',
          backgroundColor: barColor,
          opacity: 0.85,
        }}
      />
      {/* Right side bar */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-40 pointer-events-none ${isFlashing ? 'animate-flash' : ''}`}
        style={{
          width: '12px',
          backgroundColor: barColor,
          opacity: 0.85,
        }}
      />

      {/* Distance popup */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        style={{ bottom: 'max(80px, calc(env(safe-area-inset-bottom, 0px) + 80px))' }}
      >
        <div className="bg-black/80 backdrop-blur-sm text-white rounded-2xl px-6 py-4 text-center min-w-[180px] shadow-2xl">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: barColor }}
            />
            <span className="text-xs font-medium uppercase tracking-wider text-gray-300">
              {isFront ? 'Front Radar' : 'Rear Radar'}
            </span>
          </div>
          <p className="text-4xl font-bold tabular-nums">
            {Math.round(alert.distance)}m
          </p>
          <p className="text-sm text-gray-300 mt-1">
            {alert.radar.roadName} · {alert.radar.speedLimit} km/h
          </p>
        </div>
      </div>
    </>
  );
}
