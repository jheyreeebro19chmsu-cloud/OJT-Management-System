import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  Save,
  ToggleLeft,
  ToggleRight,
  Navigation,
  Info,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState } from 'react';

import { GeofenceMap } from '../../components/GeofenceMap';
import { useApp } from '../../store/AppContext';
import { GeofenceZone } from '../../types';



const BLANK_ZONE = {
  name: '',
  address: '',
  lat: 14.5547,
  lng: 121.0244,
  radius: 300,
  active: true,
};

export function AdminGeofence() {
  const { geofenceZones, addGeofenceZone, updateGeofenceZone, deleteGeofenceZone } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_ZONE);

  const upd = (f: string, v: string | number | boolean) => setForm((p) => ({ ...p, [f]: v }));

  const handleAdd = () => {
    addGeofenceZone(form);
    setForm(BLANK_ZONE);
    setShowAdd(false);
  };

  const handleEdit = (zone: GeofenceZone) => {
    setEditId(zone.id);
    setForm({
      name: zone.name,
      address: zone.address,
      lat: zone.lat,
      lng: zone.lng,
      radius: zone.radius,
      active: zone.active,
    });
  };

  const handleSaveEdit = () => {
    if (editId) {
      updateGeofenceZone(editId, form);
      setEditId(null);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this geofence zone?')) deleteGeofenceZone(id);
  };

  const handleToggle = (zone: GeofenceZone) => {
    updateGeofenceZone(zone.id, { active: !zone.active });
  };
  const invalidZones = geofenceZones.filter((zone) => !zone || !isValidCoord(zone.lat, zone.lng));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Geofence Zones</h2>
          <p className="text-sm text-gray-500">{geofenceZones.filter((z) => z.active).length} active zones</p>
        </div>
        <button
          onClick={() => {
            setForm(BLANK_ZONE);
            setShowAdd(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors shadow-sm"
        >
          <Plus size={15} />
          Add Zone
        </button>
      </div>

      {/* Info card */}
      <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">How Geofencing Works</p>
          <p className="text-blue-600 text-xs leading-relaxed">
            When a trainee attempts to clock in or out, the system checks their GPS coordinates against all active
            geofence zones. They must be within the specified radius (in meters) from the zone center to proceed with
            face verification.
          </p>
        </div>
      </div>

      {/* Map Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Navigation size={16} className="text-blue-600" />
          <div>
            <h3 className="font-bold text-gray-800 text-sm">Zone Visualization (Leaflet)</h3>
            <p className="text-xs text-gray-500">Click the map to set a zone center while adding or editing</p>
          </div>
        </div>
        {invalidZones.length > 0 && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">Warning:</span> {invalidZones.length} zone
            {invalidZones.length > 1 ? 's' : ''} with invalid coordinates {invalidZones.length > 1 ? 'were' : 'was'}{' '}
            skipped on the map.
          </div>
        )}
        <GeofenceMap
          zones={geofenceZones}
          picking={Boolean(showAdd || editId)}
          pickedCoords={showAdd || editId ? { lat: Number(form.lat), lng: Number(form.lng) } : undefined}
          onPick={(lat, lng) => {
            upd('lat', lat);
            upd('lng', lng);
          }}
        />
      </motion.div>

      {/* Zone List */}
      <div className="space-y-3">
        {geofenceZones.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
            <MapPin size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No geofence zones configured</p>
            <p className="text-gray-400 text-sm mt-1">Add a zone to enable location-based attendance</p>
          </div>
        ) : (
          geofenceZones.map((zone, idx) => (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {editId === zone.id ? (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-800">Edit Zone</h4>
                    <button onClick={() => setEditId(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                  <ZoneForm form={form} upd={upd} />
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleSaveEdit}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800"
                    >
                      <Save size={14} /> Save Changes
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${zone.active ? 'bg-blue-100' : 'bg-gray-100'}`}
                      >
                        <MapPin size={18} className={zone.active ? 'text-blue-600' : 'text-gray-400'} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-800 text-sm">{zone.name}</h4>
                          {zone.active ? (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle size={10} /> Active
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{zone.address}</p>
                        <div className="flex gap-3 mt-2 text-xs text-gray-500">
                          <span>
                            📍 {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                          </span>
                          <span>⭕ {zone.radius}m radius</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(zone)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        {zone.active ? <ToggleRight size={16} className="text-blue-500" /> : <ToggleLeft size={16} />}
                      </button>
                      <button
                        onClick={() => handleEdit(zone)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(zone.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Add Zone Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <h3 className="font-bold text-gray-800">Add Geofence Zone</h3>
                <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <div className="p-5">
                <ZoneForm form={form} upd={upd} />
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleAdd}
                    className="flex-1 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800"
                  >
                    Add Zone
                  </button>
                  <button
                    onClick={() => setShowAdd(false)}
                    className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

function ZoneForm({ form, upd }: { form: typeof BLANK_ZONE; upd: (f: string, v: string | number | boolean) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">Zone Name *</label>
        <input
          value={form.name}
          onChange={(e) => upd('name', e.target.value)}
          placeholder="e.g. Main Office"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">Address</label>
        <input
          value={form.address}
          onChange={(e) => upd('address', e.target.value)}
          placeholder="Street, City"
          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Latitude *</label>
          <input
            type="number"
            step="0.0001"
            value={form.lat}
            onChange={(e) => upd('lat', parseFloat(e.target.value))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Longitude *</label>
          <input
            type="number"
            step="0.0001"
            value={form.lng}
            onChange={(e) => upd('lng', parseFloat(e.target.value))}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-600 block mb-1">
          Radius: <span className="text-blue-600">{form.radius}m</span>
        </label>
        <input
          type="range"
          min="50"
          max="1000"
          step="50"
          value={form.radius}
          onChange={(e) => upd('radius', parseInt(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>50m</span>
          <span>500m</span>
          <span>1km</span>
        </div>
      </div>
      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
        <span className="text-sm font-medium text-gray-700">Active Zone</span>
        <button onClick={() => upd('active', !form.active)} className="relative">
          {form.active ? (
            <ToggleRight size={28} className="text-blue-600" />
          ) : (
            <ToggleLeft size={28} className="text-gray-400" />
          )}
        </button>
      </div>

      <div className="bg-yellow-50 rounded-xl p-3 text-xs text-yellow-700">
        <p className="font-semibold mb-1">💡 Tip: Get Coordinates</p>
        <p>Go to Google Maps, right-click any location, and copy the coordinates shown at the top.</p>
      </div>
    </div>
  );
}
