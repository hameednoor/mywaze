'use client';

import { useEffect, useState, useRef } from 'react';
import { usePlacesStore, SavedPlace } from '@/lib/placesStore';
import { useSettingsStore } from '@/lib/settingsStore';
import { reverseGeocode } from '@/lib/routing';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function PlacesPage() {
  const { places, loadPlaces, addPlace, updatePlace, deletePlace } = usePlacesStore();
  const { isDark, loadSettings } = useSettingsStore();
  const [editing, setEditing] = useState<SavedPlace | null>(null);
  const [pickingFromMap, setPickingFromMap] = useState(false);
  const [addType, setAddType] = useState<'home' | 'work' | 'favorite'>('favorite');
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [address, setAddress] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    loadPlaces();
    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dark = isDark();

  // Initialize map picker
  useEffect(() => {
    if (!pickingFromMap || !mapContainer.current || mapRef.current) return;

    const style = dark
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: [55.2708, 25.2048],
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('styledata', () => {
      const s = map.getStyle();
      if (!s?.layers) return;
      for (const layer of s.layers) {
        if (layer.type === 'symbol' && layer.layout?.['text-field']) {
          map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name_en'], ['get', 'name:en'], ['get', 'name']]);
        }
      }
    });

    map.on('click', async (e) => {
      const { lat: clickLat, lng: clickLng } = e.lngLat;
      setLat(clickLat.toFixed(6));
      setLng(clickLng.toFixed(6));

      if (markerRef.current) {
        markerRef.current.setLngLat([clickLng, clickLat]);
      } else {
        markerRef.current = new maplibregl.Marker({ color: '#2563EB' })
          .setLngLat([clickLng, clickLat])
          .addTo(map);
      }

      const addr = await reverseGeocode(clickLat, clickLng);
      setAddress(addr);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [pickingFromMap, dark]);

  function resetForm() {
    setName('');
    setLat('');
    setLng('');
    setAddress('');
    setEditing(null);
    setShowForm(false);
    setPickingFromMap(false);
    setAddType('favorite');
  }

  function handleSetFromCurrentLocation() {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setAddress(addr);
        setGettingLocation(false);
      },
      () => setGettingLocation(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSave() {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) return;

    if (editing) {
      updatePlace({ ...editing, name: name || editing.name, latitude: latNum, longitude: lngNum, address });
    } else {
      const placeName = name || (addType === 'home' ? 'Home' : addType === 'work' ? 'Work' : 'Favorite');
      addPlace({
        id: `p${Date.now()}`,
        name: placeName,
        latitude: latNum,
        longitude: lngNum,
        address,
        type: addType,
      });
    }
    resetForm();
  }

  function startEdit(place: SavedPlace) {
    setEditing(place);
    setName(place.name);
    setLat(place.latitude.toString());
    setLng(place.longitude.toString());
    setAddress(place.address);
    setAddType(place.type);
    setShowForm(true);
  }

  const home = places.find((p) => p.type === 'home');
  const work = places.find((p) => p.type === 'work');
  const favorites = places.filter((p) => p.type === 'favorite');

  function placeIcon(type: string) {
    if (type === 'home') return 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6';
    if (type === 'work') return 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4';
    return 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z';
  }

  return (
    <div className={`min-h-[100dvh] scrollable-page ${dark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Top bar */}
      <div className={`${dark ? 'bg-gray-800' : 'bg-gray-900'} text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20`}
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">&larr; Map</a>
        <h1 className="text-lg font-bold flex-1">Saved Places</h1>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setName(''); setLat(''); setLng(''); setAddress(''); }}
          className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium active:bg-blue-700"
        >
          + Add
        </button>
      </div>

      {/* Map picker */}
      {pickingFromMap && (
        <div className="relative w-full h-[40vh]">
          <div ref={mapContainer} className="w-full h-full" />
          <button
            onClick={() => setPickingFromMap(false)}
            className="absolute top-3 right-3 z-10 bg-white/90 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium shadow"
          >
            Done
          </button>
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Add/Edit form */}
        {showForm && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl p-4 shadow-sm space-y-3`}>
            <h3 className="text-sm font-bold">{editing ? 'Edit Place' : 'Add Place'}</h3>

            {/* Type selector */}
            {!editing && (
              <div className="flex gap-2">
                {(['home', 'work', 'favorite'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setAddType(t);
                      if (t === 'home') setName('Home');
                      else if (t === 'work') setName('Work');
                      else setName('');
                    }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                      addType === t
                        ? 'bg-blue-600 text-white'
                        : dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {t === 'home' ? 'Home' : t === 'work' ? 'Work' : 'Favorite'}
                  </button>
                ))}
              </div>
            )}

            <input
              className={`w-full border rounded-lg px-3 py-2 text-sm ${dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              placeholder="Place name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="flex gap-2">
              <button
                onClick={handleSetFromCurrentLocation}
                disabled={gettingLocation}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  dark ? 'bg-gray-700 text-blue-400 active:bg-gray-600' : 'bg-blue-50 text-blue-600 active:bg-blue-100'
                }`}
              >
                {gettingLocation ? 'Getting...' : 'Current Location'}
              </button>
              <button
                onClick={() => setPickingFromMap(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                  dark ? 'bg-gray-700 text-blue-400 active:bg-gray-600' : 'bg-blue-50 text-blue-600 active:bg-blue-100'
                }`}
              >
                Pick from Map
              </button>
            </div>

            {lat && lng && (
              <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                Location: {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}
                {address && <span className="block mt-0.5 truncate">{address}</span>}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={!lat || !lng}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium active:bg-blue-700 disabled:opacity-40"
              >
                {editing ? 'Update' : 'Save'}
              </button>
              <button
                onClick={resetForm}
                className={`py-2.5 px-4 border rounded-lg text-sm ${dark ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'}`}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Home & Work */}
        <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl overflow-hidden shadow-sm`}>
          <PlaceRow
            place={home}
            label="Home"
            type="home"
            icon={placeIcon('home')}
            onEdit={startEdit}
            onAdd={() => { setShowForm(true); setAddType('home'); setName('Home'); }}
            onDelete={deletePlace}
            isDark={dark}
          />
          <div className={`${dark ? 'border-gray-700' : 'border-gray-100'} border-t`} />
          <PlaceRow
            place={work}
            label="Work"
            type="work"
            icon={placeIcon('work')}
            onEdit={startEdit}
            onAdd={() => { setShowForm(true); setAddType('work'); setName('Work'); }}
            onDelete={deletePlace}
            isDark={dark}
          />
        </div>

        {/* Favorites */}
        {favorites.length > 0 && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl overflow-hidden shadow-sm`}>
            <div className="px-4 pt-3 pb-1">
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                Favorites
              </h3>
            </div>
            {favorites.map((p, i) => (
              <div key={p.id}>
                {i > 0 && <div className={`${dark ? 'border-gray-700' : 'border-gray-100'} border-t ml-14`} />}
                <div className="flex items-center px-4 py-3 gap-3">
                  <svg className={`w-5 h-5 flex-shrink-0 ${dark ? 'text-yellow-400' : 'text-yellow-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={placeIcon('favorite')} />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    {p.address && <p className={`text-xs truncate ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{p.address}</p>}
                  </div>
                  <button onClick={() => startEdit(p)} className="text-blue-500 text-xs font-medium">Edit</button>
                  <button onClick={() => deletePlace(p.id)} className="text-red-500 text-xs font-medium">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {places.length === 0 && !showForm && (
          <div className="text-center py-12">
            <svg className={`w-12 h-12 mx-auto mb-3 ${dark ? 'text-gray-600' : 'text-gray-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>No saved places yet</p>
            <p className={`text-xs mt-1 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Tap + Add to save your first place</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceRow({ place, label, type, icon, onEdit, onAdd, onDelete, isDark }: {
  place: SavedPlace | undefined;
  label: string;
  type: string;
  icon: string;
  onEdit: (p: SavedPlace) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  isDark: boolean;
}) {
  const iconColor = type === 'home' ? (isDark ? 'text-green-400' : 'text-green-600')
    : (isDark ? 'text-blue-400' : 'text-blue-600');

  return (
    <div className="flex items-center px-4 py-3 gap-3">
      <svg className={`w-5 h-5 flex-shrink-0 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
      </svg>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{place?.name || label}</p>
        {place?.address ? (
          <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{place.address}</p>
        ) : (
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
            {place ? 'No address' : `Set your ${label.toLowerCase()}`}
          </p>
        )}
      </div>
      {place ? (
        <div className="flex gap-2">
          <button onClick={() => onEdit(place)} className="text-blue-500 text-xs font-medium">Edit</button>
          <button onClick={() => onDelete(place.id)} className="text-red-500 text-xs font-medium">Delete</button>
        </div>
      ) : (
        <button onClick={onAdd} className="text-blue-500 text-sm font-medium">Set</button>
      )}
    </div>
  );
}
