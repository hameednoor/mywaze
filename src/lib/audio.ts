import { useSettingsStore } from './settingsStore';

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
  const settings = useSettingsStore.getState();
  if (!settings.soundEnabled) return;

  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequencyHz, ctx.currentTime);

  // Apply volume from settings (0-100 -> 0-1)
  const volume = settings.volume / 100;
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);

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

/** Find a male voice from available voices */
function getMaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  // Prefer English male voices
  const maleKeywords = ['male', 'david', 'james', 'daniel', 'mark', 'google uk english male', 'microsoft david', 'microsoft mark'];
  for (const voice of voices) {
    const name = voice.name.toLowerCase();
    if (voice.lang.startsWith('en') && maleKeywords.some(k => name.includes(k))) {
      return voice;
    }
  }
  // Fallback: any English voice with "male" in name
  for (const voice of voices) {
    if (voice.lang.startsWith('en') && voice.name.toLowerCase().includes('male')) {
      return voice;
    }
  }
  // Fallback: first English voice (often male on Android)
  for (const voice of voices) {
    if (voice.lang.startsWith('en')) return voice;
  }
  return null;
}

/** Speak a message using Web Speech API with male voice */
export function speak(text: string, lang: string = 'en-US'): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const settings = useSettingsStore.getState();
  if (!settings.voiceEnabled) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.volume = settings.volume / 100;

  const maleVoice = getMaleVoice();
  if (maleVoice) utterance.voice = maleVoice;

  window.speechSynthesis.speak(utterance);
}

/** Speak the radar voice alert at alert distance */
export function speakRadarAlert(
  direction: 'FRONT_FACING' | 'REAR_FACING',
  speedLimit: number
): void {
  const settings = useSettingsStore.getState();
  const distanceM = settings.alertDistance;
  const dirText = direction === 'REAR_FACING' ? 'Rear-facing radar' : 'Radar';
  const speedText = speedLimit > 0 ? ` Speed limit ${speedLimit} kilometers per hour.` : '';
  speak(`${dirText} ahead in ${distanceM} meters.${speedText}`);
}

/** Announce the next radar distance after passing one */
export function speakNextRadar(distanceM: number): void {
  const rounded = Math.ceil(distanceM / 100) * 100;
  speak(`Next radar is ${rounded} meters away.`);
}
