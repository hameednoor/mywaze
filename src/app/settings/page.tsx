'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/lib/settingsStore';

export default function SettingsPage() {
  const settings = useSettingsStore();

  useEffect(() => {
    settings.loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isDark = settings.isDark();

  return (
    <div className={`min-h-[100dvh] ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Top bar */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-gray-900'} text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20`}
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">&larr; Back</a>
        <h1 className="text-lg font-bold flex-1">Settings</h1>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Alert Distance */}
        <Section title="Radar Alerts" isDark={isDark}>
          <label className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Alert distance</span>
            <span className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {settings.alertDistance}m
            </span>
          </label>
          <input
            type="range"
            min={200}
            max={2000}
            step={50}
            value={settings.alertDistance}
            onChange={(e) => settings.setAlertDistance(parseInt(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>200m</span>
            <span>2000m</span>
          </div>
        </Section>

        {/* Sound */}
        <Section title="Sound" isDark={isDark}>
          <ToggleRow
            label="Beep sounds"
            description="Proximity beeps near radars"
            value={settings.soundEnabled}
            onChange={settings.setSoundEnabled}
            isDark={isDark}
          />
          <ToggleRow
            label="Voice alerts"
            description="Spoken warnings at alert distance"
            value={settings.voiceEnabled}
            onChange={settings.setVoiceEnabled}
            isDark={isDark}
          />
          <div className="mt-4">
            <label className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Volume</span>
              <span className={`text-sm font-bold ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                {settings.volume}%
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.volume}
              onChange={(e) => settings.setVolume(parseInt(e.target.value))}
              className="w-full accent-blue-600"
            />
          </div>
        </Section>

        {/* Display */}
        <Section title="Display" isDark={isDark}>
          <ToggleRow
            label="Dark mode"
            description="Dark map and UI theme"
            value={settings.darkMode}
            onChange={(v) => {
              settings.setDarkMode(v);
              if (v) settings.setAutoDarkMode(false);
            }}
            isDark={isDark}
          />
          <ToggleRow
            label="Auto night mode"
            description="Switch automatically 6PM - 6AM"
            value={settings.autoDarkMode}
            onChange={(v) => {
              settings.setAutoDarkMode(v);
              if (v) settings.setDarkMode(false);
            }}
            isDark={isDark}
          />
        </Section>

        {/* Screen */}
        <Section title="Screen" isDark={isDark}>
          <ToggleRow
            label="Keep screen awake"
            description="Prevent screen from sleeping while driving"
            value={settings.keepScreenAwake}
            onChange={settings.setKeepScreenAwake}
            isDark={isDark}
          />
        </Section>

        {/* Speed Unit */}
        <Section title="Units" isDark={isDark}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Speed unit</span>
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>km/h</span>
          </div>
        </Section>

        {/* Navigation links */}
        <Section title="Quick Links" isDark={isDark}>
          <div className="space-y-2">
            <NavLink href="/" label="Main Map" icon="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" isDark={isDark} />
            <NavLink href="/places" label="Saved Places" icon="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" isDark={isDark} />
            <NavLink href="/navigate" label="Route Planning" icon="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7l6-3 6 3v13l-6-3-6 3z" isDark={isDark} />
            <NavLink href="/admin" label="Radar Admin" icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" isDark={isDark} />
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, isDark, children }: { title: string; isDark: boolean; children: React.ReactNode }) {
  return (
    <div className={`${isDark ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-4 shadow-sm`}>
      <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, value, onChange, isDark }: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  isDark: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 mr-3">
        <span className="text-sm font-medium">{label}</span>
        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'} mt-0.5`}>{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          value ? 'bg-blue-600' : isDark ? 'bg-gray-600' : 'bg-gray-300'
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function NavLink({ href, label, icon, isDark }: { href: string; label: string; icon: string; isDark: boolean }) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
        isDark ? 'hover:bg-gray-700 active:bg-gray-700' : 'hover:bg-gray-100 active:bg-gray-100'
      }`}
    >
      <svg className={`w-5 h-5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <span className="text-sm font-medium">{label}</span>
      <svg className={`w-4 h-4 ml-auto ${isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </a>
  );
}
