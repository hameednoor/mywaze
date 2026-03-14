let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Initialize audio context — must be called from a user gesture */
export function initAudio(): void {
  getAudioContext();
}

/** Play a beep using Web Audio API oscillator */
export function playBeep(frequencyHz: number, durationMs: number): void {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequencyHz, ctx.currentTime);
  gainNode.gain.setValueAtTime(1.0, ctx.currentTime);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + durationMs / 1000);
}

/** Get beep parameters based on distance to radar (200m to 0m) */
export function getBeepParams(distance: number): {
  interval: number;
  duration: number;
  frequency: number;
} | null {
  if (distance > 200 || distance < 0) return null;

  if (distance > 150) return { interval: 500, duration: 100, frequency: 1000 };
  if (distance > 100) return { interval: 350, duration: 100, frequency: 1200 };
  if (distance > 50)  return { interval: 200, duration: 100, frequency: 1400 };
  if (distance > 25)  return { interval: 100, duration: 80,  frequency: 1600 };
  return { interval: 50, duration: 50, frequency: 1800 };
}

/** Speak a message using Web Speech API */
export function speak(text: string, lang: string = 'en-US'): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.volume = 1.0;
  window.speechSynthesis.speak(utterance);
}

/** Speak the radar voice alert at 500m */
export function speakRadarAlert(
  direction: 'FRONT_FACING' | 'REAR_FACING',
  speedLimit: number
): void {
  const dirText = direction === 'REAR_FACING' ? 'Rear-facing radar' : 'Radar';
  const speedText = speedLimit > 0 ? ` Speed limit ${speedLimit} kilometers per hour.` : '';
  speak(`${dirText} ahead in 500 meters.${speedText}`);
}
