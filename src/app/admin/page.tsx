'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRadarStore } from '@/lib/radarStore';
import { useRouteStore } from '@/lib/routeStore';
import { Radar, RadarDirection, RadarType, RadarStatus, Emirate } from '@/lib/types';

const AdminMap = dynamic(() => import('@/components/AdminMap'), { ssr: false });

const EMIRATES: Emirate[] = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'];
const RADAR_TYPES: RadarType[] = ['FIXED', 'MOBILE', 'AVERAGE_SPEED', 'RED_LIGHT'];

const ADMIN_PIN = '0000';
const PIN_STORAGE_KEY = 'mywaze_admin_auth';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);

  // Check if already authenticated this session
  useEffect(() => {
    if (sessionStorage.getItem(PIN_STORAGE_KEY) === 'true') {
      setAuthenticated(true);
    }
  }, []);

  function handlePinSubmit() {
    if (pin === ADMIN_PIN) {
      setAuthenticated(true);
      sessionStorage.setItem(PIN_STORAGE_KEY, 'true');
      setPinError(false);
    } else {
      setPinError(true);
      setPin('');
    }
  }

  if (!authenticated) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-gray-900">
        <div className="bg-gray-800 rounded-2xl p-8 w-72 text-center shadow-xl">
          <h1 className="text-white text-lg font-bold mb-1">Admin Access</h1>
          <p className="text-gray-400 text-xs mb-6">Enter 4-digit PIN</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && pin.length === 4) handlePinSubmit(); }}
            className="w-full text-center text-2xl tracking-[0.5em] bg-gray-700 text-white border-2 border-gray-600 rounded-xl py-3 focus:border-blue-500 focus:outline-none"
            autoFocus
            placeholder="____"
          />
          {pinError && <p className="text-red-400 text-xs mt-2">Wrong PIN</p>}
          <button
            onClick={handlePinSubmit}
            disabled={pin.length !== 4}
            className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-40 active:bg-blue-700"
          >
            Unlock
          </button>
          <a href="/" className="block mt-4 text-xs text-blue-400">Back to Map</a>
        </div>
      </div>
    );
  }

  return <AdminPanel />;
}

function AdminPanel() {
  const { radars, loadRadars, addRadar, updateRadar, deleteRadar } = useRadarStore();
  const { route, routeRadarIds, showAllRadars, toggleShowAllRadars, clearRoute, loadFromStorage } = useRouteStore();
  const [selected, setSelected] = useState<Radar | null>(null);
  const [adding, setAdding] = useState(false);
  const [newLat, setNewLat] = useState(0);
  const [newLng, setNewLng] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showList, setShowList] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const [draggableId, setDraggableId] = useState<string | null>(null);
  const [fixingHeadings, setFixingHeadings] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);

  // Filters
  const [filterEmirate, setFilterEmirate] = useState<string>('');
  const [filterDirection, setFilterDirection] = useState<string>('');

  useEffect(() => {
    loadRadars();
    loadFromStorage();
  }, [loadRadars, loadFromStorage]);

  const filteredRadars = radars.filter((r) => {
    // Route filter: when route active and not showing all, only show route radars
    if (route && routeRadarIds.length > 0 && !showAllRadars) {
      if (!routeRadarIds.includes(r.id)) return false;
    }
    if (filterEmirate && r.emirate !== filterEmirate) return false;
    if (filterDirection && r.direction !== filterDirection) return false;
    return true;
  });

  function handleMapClick(lat: number, lng: number) {
    setNewLat(lat);
    setNewLng(lng);
    setAdding(true);
    setSelected(null);
    setPanelOpen(true);
    setShowList(false);
    setAddMode(false);
  }

  function handleAddRadar(data: Partial<Radar>) {
    const radar: Radar = {
      id: `r${Date.now()}`,
      latitude: newLat,
      longitude: newLng,
      roadName: data.roadName || '',
      emirate: (data.emirate as Emirate) || 'Dubai',
      direction: (data.direction as RadarDirection) || 'FRONT_FACING',
      speedLimit: data.speedLimit || 120,
      radarType: (data.radarType as RadarType) || 'FIXED',
      status: 'ACTIVE',
      headingDegrees: data.headingDegrees || 0,
      lastVerified: null,
      notes: data.notes || '',
    };
    addRadar(radar);
    setAdding(false);
    setPanelOpen(false);
  }

  function handleToggleDirection(radar: Radar) {
    const updated = {
      ...radar,
      direction: (radar.direction === 'FRONT_FACING' ? 'REAR_FACING' : 'FRONT_FACING') as RadarDirection,
    };
    updateRadar(updated);
    setSelected(updated);
  }

  function handleRadarClick(radar: Radar) {
    setSelected(radar);
    setAdding(false);
    setPanelOpen(false);
    setShowList(false);
    setDraggableId(null);
  }

  function closePanel() {
    setPanelOpen(false);
    setSelected(null);
    setAdding(false);
    setShowList(false);
    setDraggableId(null);
  }

  const hasPanel = panelOpen || showList;

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="bg-gray-900 text-white px-3 py-2 flex items-center gap-2 flex-shrink-0 z-20">
        <a href="/" className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap">&larr; Back</a>
        <h1 className="text-sm md:text-lg font-bold flex-1 truncate">Radar Admin</h1>

        {/* Filters inline */}
        <select
          value={filterEmirate}
          onChange={(e) => setFilterEmirate(e.target.value)}
          className="bg-gray-800 text-white border border-gray-700 rounded px-1.5 py-1 text-xs max-w-[100px] md:max-w-none"
        >
          <option value="">All Emirates</option>
          {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>

        {/* Add mode toggle */}
        <button
          onClick={() => { setAddMode(!addMode); if (!addMode) { setPanelOpen(false); setSelected(null); setAdding(false); setShowList(false); } }}
          className={`px-2 py-1 rounded text-xs font-medium ${addMode ? 'bg-green-600 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          + Add
        </button>

        {/* List toggle */}
        <button
          onClick={() => { setShowList(!showList); if (!showList) { setPanelOpen(false); setSelected(null); setAdding(false); setAddMode(false); } }}
          className={`px-2 py-1 rounded text-xs font-medium ${showList ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}
        >
          List
        </button>

        {/* Route radar toggle */}
        {route && routeRadarIds.length > 0 && (
          <button
            onClick={toggleShowAllRadars}
            className={`px-2 py-1 rounded text-xs font-medium ${showAllRadars ? 'bg-gray-700 hover:bg-gray-600' : 'bg-blue-600'}`}
          >
            {showAllRadars ? 'All' : 'Route'}
          </button>
        )}

        {/* Fix Headings */}
        <button
          onClick={async () => {
            if (fixingHeadings) return;
            setFixingHeadings(true);
            setFixResult(null);
            try {
              const res = await fetch('/api/fix-headings', { method: 'POST' });
              const data = await res.json();
              setFixResult(`Fixed ${data.fixed}/${data.total} headings`);
              loadRadars(); // reload to show updated arrows
            } catch {
              setFixResult('Error fixing headings');
            }
            setFixingHeadings(false);
          }}
          disabled={fixingHeadings}
          className={`px-2 py-1 rounded text-xs font-medium ${fixingHeadings ? 'bg-yellow-600 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'}`}
          title="Fix heading=0 radars using OSRM road data"
        >
          {fixingHeadings ? 'Fixing...' : 'Fix ↑'}
        </button>

        <span className="text-xs text-gray-400 hidden sm:block">{filteredRadars.length}</span>
      </div>

      {/* Route info bar */}
      {route && (
        <div className="bg-blue-900 text-white px-3 py-1.5 flex items-center gap-2 flex-shrink-0 z-20 text-xs">
          <span className="flex-1">
            Navigating · {route.distanceKm?.toFixed(1)} km · {routeRadarIds.length} radar{routeRadarIds.length !== 1 ? 's' : ''}
          </span>
          <button onClick={clearRoute} className="text-red-400 font-medium px-2 py-0.5 bg-white/10 rounded">
            Cancel
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 relative overflow-hidden">
        {/* Fix result toast */}
        {fixResult && (
          <div className="absolute top-0 left-0 right-0 z-30 bg-blue-600 text-white text-center py-2 text-sm font-medium cursor-pointer" onClick={() => setFixResult(null)}>
            {fixResult} (tap to dismiss)
          </div>
        )}

        {/* Add mode banner */}
        {addMode && !fixResult && (
          <div className="absolute top-0 left-0 right-0 z-30 bg-green-600 text-white text-center py-2 text-sm font-medium">
            Tap on the map to place a new radar
          </div>
        )}

        {/* Full-screen map */}
        <AdminMap
          radars={filteredRadars}
          selectedId={selected?.id ?? null}
          addMode={addMode}
          draggableId={draggableId}
          onRadarClick={handleRadarClick}
          onMapClick={handleMapClick}
          onRadarMove={(radar, lat, lng) => {
            const updated = { ...radar, latitude: lat, longitude: lng };
            updateRadar(updated);
            if (selected?.id === radar.id) setSelected(updated);
          }}
        />

        {/* Edit button when radar selected but panel closed */}
        {selected && !panelOpen && !showList && (
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center gap-2">
            <button
              onClick={() => { setPanelOpen(true); setAdding(false); }}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium shadow-lg active:bg-blue-700"
            >
              Edit Radar
            </button>
            <button
              onClick={() => { setSelected(null); setDraggableId(null); }}
              className="px-4 py-2.5 bg-gray-700 text-white rounded-full text-sm shadow-lg active:bg-gray-600"
            >
              Deselect
            </button>
          </div>
        )}

        {/* Bottom sheet - radar detail / add form */}
        {panelOpen && (
          <div className="absolute bottom-0 left-0 right-0 z-20 max-h-[70vh] overflow-y-auto bg-white rounded-t-2xl shadow-2xl animate-slide-up">
            {/* Drag handle */}
            <div className="sticky top-0 bg-white rounded-t-2xl pt-2 pb-1 flex justify-center z-10">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Close button */}
            <button
              onClick={closePanel}
              className="absolute top-2 right-3 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 text-lg z-10"
            >
              &times;
            </button>

            {/* Add new radar form */}
            {adding && (
              <div className="px-4 pb-4">
                <h3 className="text-sm font-bold text-blue-800 mb-1">Add New Radar</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Lat: {newLat.toFixed(6)}, Lng: {newLng.toFixed(6)}
                </p>
                <AddRadarForm onSave={handleAddRadar} onCancel={closePanel} />
              </div>
            )}

            {/* Selected radar detail */}
            {selected && !adding && (
              <div className="px-4 pb-4">
                <h3 className="text-sm font-bold text-gray-800 mb-3">Radar Details</h3>
                <div className="space-y-3">
                  {/* Direction toggle */}
                  <button
                    onClick={() => handleToggleDirection(selected)}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${
                      selected.direction === 'FRONT_FACING'
                        ? 'bg-green-500 text-white active:bg-green-600'
                        : 'bg-red-500 text-white active:bg-red-600'
                    }`}
                  >
                    {selected.direction === 'FRONT_FACING' ? 'FRONT FACING' : 'REAR FACING'}
                    <span className="block text-xs font-normal mt-0.5">Tap to toggle</span>
                  </button>

                  <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
                    <span>Lat: {selected.latitude.toFixed(6)}, Lng: {selected.longitude.toFixed(6)}</span>
                    <button
                      onClick={() => { setDraggableId(selected.id); setPanelOpen(false); }}
                      className="block text-blue-500 font-medium mt-0.5 hover:text-blue-700"
                    >
                      Enable drag to move &rarr;
                    </button>
                  </div>

                  {/* Two-column grid for compact fields */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Road</label>
                      <input
                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                        value={selected.roadName}
                        onChange={(e) => {
                          const updated = { ...selected, roadName: e.target.value };
                          setSelected(updated);
                          updateRadar(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Speed (km/h)</label>
                      <input
                        type="number"
                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                        value={selected.speedLimit}
                        onChange={(e) => {
                          const updated = { ...selected, speedLimit: parseInt(e.target.value) || 0 };
                          setSelected(updated);
                          updateRadar(updated);
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Emirate</label>
                      <select
                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                        value={selected.emirate}
                        onChange={(e) => {
                          const updated = { ...selected, emirate: e.target.value as Emirate };
                          setSelected(updated);
                          updateRadar(updated);
                        }}
                      >
                        {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Type</label>
                      <select
                        className="w-full border rounded-lg px-2 py-1.5 text-sm"
                        value={selected.radarType}
                        onChange={(e) => {
                          const updated = { ...selected, radarType: e.target.value as RadarType };
                          setSelected(updated);
                          updateRadar(updated);
                        }}
                      >
                        {RADAR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Heading / Direction compass */}
                  <div>
                    <label className="text-xs text-gray-500">Facing Direction ({selected.headingDegrees || 0}°)</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="range"
                        min={0}
                        max={359}
                        value={selected.headingDegrees || 0}
                        onChange={(e) => {
                          const updated = { ...selected, headingDegrees: parseInt(e.target.value) };
                          setSelected(updated);
                          updateRadar(updated);
                        }}
                        className="flex-1 accent-blue-600"
                      />
                      <div
                        className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0"
                        title={`${selected.headingDegrees || 0}°`}
                      >
                        <div
                          style={{ transform: `rotate(${selected.headingDegrees || 0}deg)` }}
                          className="text-red-500 text-sm"
                        >↑</div>
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5 px-1">
                      <button type="button" onClick={() => { const u = { ...selected, headingDegrees: 0 }; setSelected(u); updateRadar(u); }}>N</button>
                      <button type="button" onClick={() => { const u = { ...selected, headingDegrees: 90 }; setSelected(u); updateRadar(u); }}>E</button>
                      <button type="button" onClick={() => { const u = { ...selected, headingDegrees: 180 }; setSelected(u); updateRadar(u); }}>S</button>
                      <button type="button" onClick={() => { const u = { ...selected, headingDegrees: 270 }; setSelected(u); updateRadar(u); }}>W</button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <select
                      className="w-full border rounded-lg px-2 py-1.5 text-sm"
                      value={selected.status}
                      onChange={(e) => {
                        const updated = { ...selected, status: e.target.value as RadarStatus };
                        setSelected(updated);
                        updateRadar(updated);
                      }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                    </select>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={closePanel}
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium active:bg-green-700"
                    >Save</button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this radar?')) {
                          deleteRadar(selected.id);
                          closePanel();
                        }
                      }}
                      className="py-2 px-4 bg-red-500 text-white rounded-lg text-xs font-medium active:bg-red-600"
                    >Delete</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Radar list overlay */}
        {showList && (
          <div className="absolute bottom-0 left-0 right-0 z-20 max-h-[50vh] overflow-y-auto bg-white rounded-t-2xl shadow-2xl">
            {/* Drag handle */}
            <div className="sticky top-0 bg-white rounded-t-2xl pt-2 pb-1 flex justify-center z-10">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <div className="px-3 pb-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase">
                  Radars ({filteredRadars.length})
                </h3>
                <button onClick={() => setShowList(false)} className="text-gray-400 text-sm">&times;</button>
              </div>
              <div className="space-y-1">
                {filteredRadars.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { handleRadarClick(r); setShowList(false); }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors active:bg-blue-100 ${
                      selected?.id === r.id ? 'bg-blue-100' : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2.5 h-2.5 flex-shrink-0 rounded-full ${
                          r.direction === 'FRONT_FACING' ? 'bg-green-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="font-medium text-gray-800 truncate">{r.roadName || 'Unnamed'}</span>
                      <span className="text-gray-400 ml-auto flex-shrink-0">{r.speedLimit}</span>
                    </div>
                    <p className="text-gray-400 truncate pl-5">{r.emirate}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CSS for slide-up animation */}
      <style jsx global>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}

function AddRadarForm({ onSave, onCancel }: {
  onSave: (data: Partial<Radar>) => void;
  onCancel: () => void;
}) {
  const [roadName, setRoadName] = useState('');
  const [speedLimit, setSpeedLimit] = useState(120);
  const [direction, setDirection] = useState<RadarDirection>('FRONT_FACING');
  const [emirate, setEmirate] = useState<Emirate>('Dubai');
  const [radarType, setRadarType] = useState<RadarType>('FIXED');
  const [headingDegrees, setHeadingDegrees] = useState(0);

  return (
    <div className="space-y-2">
      <input
        className="w-full border rounded-lg px-2 py-2 text-sm"
        placeholder="Road name"
        value={roadName}
        onChange={(e) => setRoadName(e.target.value)}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          className="w-full border rounded-lg px-2 py-2 text-sm"
          placeholder="Speed limit"
          value={speedLimit}
          onChange={(e) => setSpeedLimit(parseInt(e.target.value) || 0)}
        />
        <select
          className="w-full border rounded-lg px-2 py-2 text-sm"
          value={direction}
          onChange={(e) => setDirection(e.target.value as RadarDirection)}
        >
          <option value="FRONT_FACING">Front Facing</option>
          <option value="REAR_FACING">Rear Facing</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="w-full border rounded-lg px-2 py-2 text-sm"
          value={emirate}
          onChange={(e) => setEmirate(e.target.value as Emirate)}
        >
          {EMIRATES.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select
          className="w-full border rounded-lg px-2 py-2 text-sm"
          value={radarType}
          onChange={(e) => setRadarType(e.target.value as RadarType)}
        >
          {['FIXED', 'MOBILE', 'AVERAGE_SPEED', 'RED_LIGHT'].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      {/* Heading slider */}
      <div>
        <label className="text-xs text-gray-500">Facing Direction ({headingDegrees}°)</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={359}
            value={headingDegrees}
            onChange={(e) => setHeadingDegrees(parseInt(e.target.value))}
            className="flex-1 accent-blue-600"
          />
          <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center flex-shrink-0">
            <div style={{ transform: `rotate(${headingDegrees}deg)` }} className="text-red-500 text-sm">↑</div>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-0.5 px-1">
          <button type="button" onClick={() => setHeadingDegrees(0)}>N</button>
          <button type="button" onClick={() => setHeadingDegrees(90)}>E</button>
          <button type="button" onClick={() => setHeadingDegrees(180)}>S</button>
          <button type="button" onClick={() => setHeadingDegrees(270)}>W</button>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({ roadName, speedLimit, direction, emirate, radarType, headingDegrees })}
          className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium active:bg-blue-700"
        >Add Radar</button>
        <button
          onClick={onCancel}
          className="py-2.5 px-4 border rounded-lg text-sm text-gray-600 active:bg-gray-100"
        >Cancel</button>
      </div>
    </div>
  );
}
