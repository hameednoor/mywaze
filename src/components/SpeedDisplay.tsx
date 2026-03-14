'use client';

import { useState } from 'react';
import { RadarAlert } from '@/lib/types';

interface Props {
  speedMs: number | null; // speed in m/s from GPS
  nearestAlert: RadarAlert | null;
}

export default function SpeedDisplay({ speedMs, nearestAlert }: Props) {
  const [large, setLarge] = useState(false);
  const speedKmh = speedMs !== null ? Math.round(speedMs * 3.6) : 0;
  const speedLimit = nearestAlert?.radar.speedLimit ?? null;

  const overSpeed = speedLimit !== null && speedKmh > speedLimit;
  const wayOver = speedLimit !== null && speedKmh > speedLimit + 20;

  // Sizes
  const outer = large ? 120 : 72;
  const ring = large ? 8 : 5;
  const limitSize = large ? 32 : 18;
  const speedSize = large ? 28 : 16;
  const unitSize = large ? 11 : 8;

  return (
    <div className="fixed bottom-4 left-4 z-30 flex flex-col items-start gap-2" style={{ bottom: 'max(16px, env(safe-area-inset-bottom, 16px))', left: 'max(16px, env(safe-area-inset-left, 16px))' }}>
      {/* Waze-style round speed widget */}
      <div
        onClick={() => setLarge(!large)}
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
                margin: large ? '3px 0' : '2px 0',
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
        onClick={() => setLarge(!large)}
        style={{
          width: large ? 28 : 22,
          height: large ? 28 : 22,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid #4B5563',
          color: '#9CA3AF',
          fontSize: large ? 14 : 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          alignSelf: 'center',
          transition: 'all 0.3s ease',
          marginLeft: large ? (outer / 2 - 14) : (outer / 2 - 11),
        }}
        title={large ? 'Make smaller' : 'Make larger'}
      >
        {large ? '▾' : '▴'}
      </button>
    </div>
  );
}
