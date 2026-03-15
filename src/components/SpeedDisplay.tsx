'use client';

import { useState } from 'react';
import { RadarAlert } from '@/lib/types';

interface Props {
  speedMs: number | null; // speed in m/s from GPS
  nearestAlert: RadarAlert | null;
}

export default function SpeedDisplay({ speedMs, nearestAlert }: Props) {
  const [sizeIndex, setSizeIndex] = useState(0); // 0=small, 1=medium, 2=large
  const speedKmh = speedMs !== null ? Math.round(speedMs * 3.6) : 0;
  const speedLimit = nearestAlert?.radar.speedLimit ?? null;

  const overSpeed = speedLimit !== null && speedKmh > speedLimit;
  const wayOver = speedLimit !== null && speedKmh > speedLimit + 20;

  // 3 sizes: small, medium, large
  const sizes = [
    { outer: 72, ring: 5, limitSize: 18, speedSize: 16, unitSize: 8 },
    { outer: 120, ring: 8, limitSize: 32, speedSize: 28, unitSize: 11 },
    { outer: 160, ring: 10, limitSize: 42, speedSize: 36, unitSize: 14 },
  ];
  const { outer, ring, limitSize, speedSize, unitSize } = sizes[sizeIndex];
  const cycleSize = () => setSizeIndex((sizeIndex + 1) % 3);

  return (
    <div className="fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2" style={{ bottom: 'max(16px, env(safe-area-inset-bottom, 16px))', left: 'max(16px, env(safe-area-inset-left, 16px))' }}>
      {/* Waze-style round speed widget */}
      <div
        onClick={cycleSize}
        style={{
          width: outer,
          height: outer,
          transition: 'all 0.3s ease',
          cursor: 'pointer',
        }}
        className="relative select-none"
        title="Tap to resize"
      >
        {/* Outer circle — red ring when speed limit active, gray when not */}
        <div
          style={{
            width: outer,
            height: outer,
            borderRadius: '50%',
            borderWidth: ring,
            borderStyle: 'solid',
            borderColor: speedLimit !== null ? '#EF4444' : '#6B7280',
            background: wayOver ? '#1a0000' : '#111827',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: wayOver
              ? '0 0 20px rgba(239,68,68,0.6), inset 0 0 10px rgba(239,68,68,0.2)'
              : '0 4px 12px rgba(0,0,0,0.4)',
            transition: 'all 0.3s ease',
          }}
        >
          {/* Posted speed limit — top half */}
          {speedLimit !== null && speedLimit > 0 && (
            <span
              style={{
                fontSize: limitSize,
                fontWeight: 800,
                color: '#FFFFFF',
                lineHeight: 1,
                letterSpacing: -0.5,
              }}
            >
              {speedLimit}
            </span>
          )}

          {/* Divider line */}
          {speedLimit !== null && speedLimit > 0 && (
            <div
              style={{
                width: '60%',
                height: 1,
                background: '#4B5563',
                margin: sizeIndex > 0 ? '3px 0' : '2px 0',
              }}
            />
          )}

          {/* Actual speed — bottom half */}
          <span
            style={{
              fontSize: speedSize,
              fontWeight: 700,
              lineHeight: 1,
              color: wayOver ? '#EF4444' : overSpeed ? '#FBBF24' : '#34D399',
              transition: 'color 0.3s',
            }}
          >
            {speedKmh}
          </span>

          {/* km/h label */}
          <span
            style={{
              fontSize: unitSize,
              color: '#9CA3AF',
              lineHeight: 1,
              marginTop: 1,
            }}
          >
            km/h
          </span>
        </div>
      </div>

      {/* Size toggle arrow */}
      <button
        onClick={cycleSize}
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid #4B5563',
          color: '#9CA3AF',
          fontSize: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          alignSelf: 'center',
          transition: 'all 0.3s ease',
          marginLeft: outer / 2 - 11,
        }}
        title="Change size"
      >
        {sizeIndex === 2 ? '▾' : '▴'}
      </button>
    </div>
  );
}
