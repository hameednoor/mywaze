'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSettingsStore } from '@/lib/settingsStore';
import { useCustomPlacesStore } from '@/lib/customPlacesStore';
import { useAuthStore } from '@/lib/authStore';
import { parseGoogleMapsInput, isInUAE, CustomPlace } from '@/lib/customPlaces';
import { reverseGeocode } from '@/lib/routing';

export default function SettingsPage() {
  const settings = useSettingsStore();
  const { places: customPlaces, loadPlaces, addPlace, removePlace } = useCustomPlacesStore();
  const [linkInput, setLinkInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [adding, setAdding] = useState(false);
  const [policeUpdating, setPoliceUpdating] = useState(false);
  const [policeResult, setPoliceResult] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [policeDetails, setPoliceDetails] = useState<any>(null);
  const { user, isOwner, signOut } = useAuthStore();
  const [allowedUsers, setAllowedUsers] = useState<{ email: string; name: string; is_active: boolean; created_at: string }[]>([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [userMsg, setUserMsg] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const loadAllowedUsers = async () => {
    if (!user?.email) return;
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/auth/users', {
        headers: { 'x-user-email': user.email },
      });
      if (res.ok) {
        setAllowedUsers(await res.json());
      }
    } catch { /* ignore */ }
    setLoadingUsers(false);
  };

  useEffect(() => {
    settings.loadSettings();
    loadPlaces();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isDark = settings.isDark();

  async function handleAddPlace() {
    setAddError('');
    setAddSuccess('');

    if (!linkInput.trim()) {
      setAddError('Paste a Google Maps link or coordinates');
      return;
    }

    const coords = parseGoogleMapsInput(linkInput);
    if (!coords) {
      setAddError('Could not extract coordinates. Paste a Google Maps link (e.g. https://maps.google.com/.../@25.123,55.456,...) or raw coordinates (e.g. 25.123, 55.456)');
      return;
    }

    if (!isInUAE(coords.lat, coords.lng)) {
      setAddError('Location is outside UAE');
      return;
    }

    setAdding(true);

    // Get a name — use provided name or reverse geocode
    let placeName = nameInput.trim();
    if (!placeName) {
      const address = await reverseGeocode(coords.lat, coords.lng);
      placeName = address ? address.split(',')[0] : `Place ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    }

    const place: CustomPlace = {
      id: `cp_${Date.now()}`,
      name: placeName,
      latitude: coords.lat,
      longitude: coords.lng,
      addedAt: new Date().toISOString(),
    };

    addPlace(place);
    setLinkInput('');
    setNameInput('');
    setAddSuccess(`Added: ${placeName}`);
    setAdding(false);

    setTimeout(() => setAddSuccess(''), 3000);
  }

  return (
    <div className={`min-h-[100dvh] scrollable-page ${isDark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Top bar */}
      <div className={`${isDark ? 'bg-gray-800' : 'bg-gray-900'} text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20`}
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">&larr; Back</Link>
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

        {/* Radar Data Updates */}
        <Section title="Radar Data" isDark={isDark}>
          <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Fetch latest speed camera locations from police records database and add any missing radars to your map.
          </p>
          <button
            onClick={async () => {
              setPoliceUpdating(true);
              setPoliceResult(null);
              try {
                const res = await fetch('/api/update-police-radars', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  setPoliceResult(
                    `Done! Found ${data.policeTotal} cameras. ${data.exactMatch} exact. ${data.positionsCorrected} corrected. ${data.newRadarsAdded} added. ${data.notInPoliceRecords} not in police records.`
                  );
                  setPoliceDetails(data);
                } else {
                  setPoliceResult(`Error: ${data.error}`);
                  setPoliceDetails(null);
                }
              } catch (err) {
                setPoliceResult(`Failed: ${String(err)}`);
                setPoliceDetails(null);
              }
              setPoliceUpdating(false);
            }}
            disabled={policeUpdating}
            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 active:bg-blue-700"
          >
            {policeUpdating ? 'Updating... (this takes ~1 minute)' : 'Update from Police Records'}
          </button>
          {policeResult && (
            <p className={`text-xs mt-2 ${policeResult.startsWith('Done') ? 'text-green-500' : 'text-red-500'}`}>
              {policeResult}
            </p>
          )}
          {policeDetails && (
            <div className="mt-3 space-y-3">
              {/* Added */}
              {policeDetails.added?.length > 0 && (
                <details className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <summary className="cursor-pointer font-semibold text-green-500">
                    + {policeDetails.added.length} radars added
                  </summary>
                  <div className={`mt-1 max-h-40 overflow-y-auto space-y-1 ${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-2`}>
                    {policeDetails.added.map((r: { lat: number; lon: number; emirate: string }, i: number) => (
                      <div key={i}>{r.emirate} — {r.lat.toFixed(5)}, {r.lon.toFixed(5)}</div>
                    ))}
                  </div>
                </details>
              )}
              {/* Corrected */}
              {policeDetails.correctedList?.length > 0 && (
                <details className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <summary className="cursor-pointer font-semibold text-yellow-500">
                    ~ {policeDetails.correctedList.length} positions corrected
                  </summary>
                  <div className={`mt-1 max-h-40 overflow-y-auto space-y-1 ${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-2`}>
                    {policeDetails.correctedList.map((c: { id: string; road: string; emirate: string; shiftM: number }, i: number) => (
                      <div key={i}>{c.emirate}{c.road ? ` — ${c.road}` : ''} — moved {c.shiftM}m</div>
                    ))}
                  </div>
                </details>
              )}
              {/* Not in police records */}
              {policeDetails.notInPolice?.length > 0 && (
                <details className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  <summary className="cursor-pointer font-semibold text-red-400">
                    ? {policeDetails.notInPoliceRecords} radars not in police records
                  </summary>
                  <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    These exist in your app but have no matching police record. They may have been removed or are from a different source.
                  </p>
                  <div className={`mt-1 max-h-40 overflow-y-auto space-y-1 ${isDark ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-2`}>
                    {policeDetails.notInPolice.map((r: { id: string; latitude: number; longitude: number; road: string; emirate: string }, i: number) => (
                      <div key={i}>{r.emirate}{r.road ? ` — ${r.road}` : ''} — {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </Section>

        {/* Speed Unit */}
        <Section title="Units" isDark={isDark}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Speed unit</span>
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>km/h</span>
          </div>
        </Section>

        {/* Custom Places */}
        <Section title="Add Custom Places" isDark={isDark}>
          <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Paste a Google Maps link or coordinates to add a place. These will appear in search results when planning a route.
          </p>

          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Place name (optional)"
            className={`w-full rounded-xl px-3 py-2.5 text-sm mb-2 ${
              isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100 text-gray-900 placeholder-gray-500'
            }`}
          />

          <textarea
            value={linkInput}
            onChange={(e) => { setLinkInput(e.target.value); setAddError(''); }}
            placeholder="Paste Google Maps link or coordinates (e.g. 25.123, 55.456)"
            rows={3}
            className={`w-full rounded-xl px-3 py-2.5 text-sm resize-none ${
              isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100 text-gray-900 placeholder-gray-500'
            }`}
          />

          {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}
          {addSuccess && <p className="text-green-500 text-xs mt-2">{addSuccess}</p>}

          <button
            onClick={handleAddPlace}
            disabled={adding || !linkInput.trim()}
            className="w-full mt-3 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 active:bg-blue-700"
          >
            {adding ? 'Adding...' : 'Add Place'}
          </button>

          {/* Existing custom places */}
          {customPlaces.length > 0 && (
            <div className="mt-4">
              <h3 className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Saved Places ({customPlaces.length})
              </h3>
              <div className="space-y-1">
                {customPlaces.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                      isDark ? 'bg-gray-700' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                      </p>
                    </div>
                    <button
                      onClick={() => removePlace(p.id)}
                      className="text-red-400 text-xs font-medium ml-2 px-2 py-1 active:text-red-600 flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Account */}
        <Section title="Account" isDark={isDark}>
          {user && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.picture && (
                  <img src={user.picture} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                )}
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{user.email}</p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="text-red-400 text-xs font-medium px-3 py-1.5 bg-red-400/10 rounded-lg active:bg-red-400/20"
              >
                Sign out
              </button>
            </div>
          )}
        </Section>

        {/* Access Control — owner only */}
        {isOwner && (
          <Section title="Access Control" isDark={isDark}>
            <p className={`text-xs mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Manage who can access the app. Add users by their Google email.
            </p>

            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="Google email"
                className={`flex-1 rounded-xl px-3 py-2 text-sm ${
                  isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                }`}
              />
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Name"
                className={`w-28 rounded-xl px-3 py-2 text-sm ${
                  isDark ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-gray-100 text-gray-900 placeholder-gray-500'
                }`}
              />
            </div>
            <button
              onClick={async () => {
                if (!newUserEmail.trim()) return;
                const res = await fetch('/api/auth/users', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email || '' },
                  body: JSON.stringify({ email: newUserEmail, name: newUserName }),
                });
                if (res.ok) {
                  setUserMsg(`Added: ${newUserEmail}`);
                  setNewUserEmail('');
                  setNewUserName('');
                  loadAllowedUsers();
                } else {
                  setUserMsg('Failed to add user');
                }
                setTimeout(() => setUserMsg(''), 3000);
              }}
              disabled={!newUserEmail.trim()}
              className="w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 active:bg-blue-700 mb-2"
            >
              Grant Access
            </button>
            {userMsg && <p className="text-xs text-green-500 mb-2">{userMsg}</p>}

            {/* Load and show existing users */}
            {!loadingUsers && allowedUsers.length === 0 && (
              <button
                onClick={loadAllowedUsers}
                className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'} font-medium`}
              >
                Load user list
              </button>
            )}
            {loadingUsers && <p className="text-xs text-gray-400">Loading...</p>}
            {allowedUsers.length > 0 && (
              <div className="space-y-1 mt-2">
                <h3 className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Authorized Users ({allowedUsers.filter(u => u.is_active).length})
                </h3>
                {allowedUsers.map((u) => (
                  <div
                    key={u.email}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                      isDark ? 'bg-gray-700' : 'bg-gray-50'
                    } ${!u.is_active ? 'opacity-40' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                      <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{u.email}</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (u.is_active) {
                          await fetch('/api/auth/users', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email || '' },
                            body: JSON.stringify({ email: u.email }),
                          });
                        } else {
                          await fetch('/api/auth/users', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-user-email': user?.email || '' },
                            body: JSON.stringify({ email: u.email, name: u.name }),
                          });
                        }
                        loadAllowedUsers();
                      }}
                      className={`text-xs font-medium ml-2 px-2 py-1 rounded flex-shrink-0 ${
                        u.is_active ? 'text-red-400 active:text-red-600' : 'text-green-400 active:text-green-600'
                      }`}
                    >
                      {u.is_active ? 'Revoke' : 'Restore'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

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
