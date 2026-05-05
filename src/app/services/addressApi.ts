// Geonames wrapper used for address autocomplete in the Register page.
// Requires `VITE_GEONAMES_USERNAME` to be set in the frontend environment.

import countriesCities from '../data/countries_cities.json';

// API base is only used when explicitly configured via VITE_DJANGO_API_URL
const RAW_API_BASE = (import.meta as ImportMeta).env.VITE_DJANGO_API_URL as string | undefined;
// If the API base points to the external production host (Railway), disable network proxy usage
// so the frontend falls back to local bundled data and avoids cross-origin calls.
const API_BASE = RAW_API_BASE && RAW_API_BASE.includes('railway.app') ? undefined : RAW_API_BASE;

// Build a flat city index for faster searching
interface IndexedCity {
  name: string;
  countryCode: string;
  population: number;
  lat: number;
  lon: number;
  nameLower: string;
}

let cityIndex: IndexedCity[] = [];

function buildCityIndex() {
  if (cityIndex.length > 0) return; // already built
  const allCities: IndexedCity[] = [];
  (countriesCities as any).countries.forEach((c: any) => {
    c.cities.forEach((ct: any) => {
      allCities.push({
        name: ct.name,
        countryCode: c.code,
        population: ct.population,
        lat: ct.lat,
        lon: ct.lon,
        nameLower: ct.name.toLowerCase(),
      });
    });
  });
  // Sort by population descending for better ranking
  allCities.sort((a, b) => b.population - a.population);
  cityIndex = allCities;
}

// Search for places via backend Geonames proxy. Returns the raw JSON response.
export async function autocompletePlaces(input: string) {
  if (!input || input.length < 2) return { geonames: [] } as any;
  if (!API_BASE) {
    // fallback: search bundled countries+cities by city name
    buildCityIndex();
    const q = input.toLowerCase();
    const matches = cityIndex
      .filter(c => c.nameLower.includes(q) || c.nameLower.startsWith(q))
      .slice(0, 10)
      .map(c => ({ name: c.name, countryCode: c.countryCode, population: c.population }));
    return { geonames: matches } as any;
  }
  const q = encodeURIComponent(input);
  const url = `${API_BASE.replace(/\/$/, '')}/geonames/proxy/?q=${q}&maxRows=10`;
  const res = await fetch(url);
  return res.json();
}

// Get place details by geonameId via backend proxy
export async function getPlaceDetails(geonameId: string | number) {
  if (!geonameId) return null;
  const url = `${API_BASE.replace(/\/$/, '')}/geonames/proxy/?geonameId=${encodeURIComponent(String(geonameId))}`;
  const res = await fetch(url);
  return res.json();
}

export async function getCountries() {
  if (!API_BASE) {
    // include bundled countries + any persisted offline country codes
    try {
      const base = (countriesCities as any).countries || [];
      const offline = await listOfflineCountries();
      const missing = (offline || []).filter((c: string) => !base.find((b: any) => String(b.code).toUpperCase() === String(c).toUpperCase()));
      const added = missing.map((c: string) => ({ name: c, code: c }));
      return Promise.resolve({ geonames: base.concat(added) });
    } catch {
      return Promise.resolve({ geonames: (countriesCities as any).countries || [] });
    }
  }
  const url = `${API_BASE.replace(/\/$/, '')}/geonames/countries/`;
  const res = await fetch(url);
  return res.json();
}

export async function searchCities(country: string, q: string) {
  if (!API_BASE) {
    buildCityIndex();
    const countryCode = country.toUpperCase();
    let results = cityIndex.filter(c => c.countryCode === countryCode);

    if (q) {
      const queryLower = q.toLowerCase();
      results = results.filter(c => c.nameLower.includes(queryLower) || c.nameLower.startsWith(queryLower));
    }

    // Return top results sorted by population
    const out = results.slice(0, 50).map(c => ({
      name: c.name,
      countryCode: c.countryCode,
      population: c.population,
      lat: c.lat,
      lon: c.lon,
    }));
    return Promise.resolve({ geonames: out });
  }
  const url = `${API_BASE.replace(/\/$/, '')}/geonames/cities/?q=${encodeURIComponent(q || '')}&country=${encodeURIComponent(country || '')}&maxRows=50`;
  const res = await fetch(url);
  return res.json();
}

export async function searchStreets(country: string, city: string, q: string) {
  // caching + offline dataset support
  const cacheKey = `streets:${(country || '').toUpperCase()}:${(city || '').toLowerCase()}:${(q || '').toLowerCase()}`;

  // If offline dataset for this country is loaded, use it
  const countryCode = (country || '').toUpperCase();
  if (offlineStreetsRegistry[countryCode]) {
    try {
      const data = offlineStreetsRegistry[countryCode];
      const cityKey = (city || '').toLowerCase();
      const cityStreets = data.streets && data.streets[cityKey] ? data.streets[cityKey] : [];
      const qLower = (q || '').toLowerCase();
      const filtered = qLower ? cityStreets.filter(s => s.toLowerCase().includes(qLower)) : cityStreets.slice();
      const sorted = filtered.slice().sort((a, b) => a.localeCompare(b));
      return Promise.resolve({ results: sorted.map(s => ({ display_name: s, name: s })) });
    } catch {
      // fall through to network/cache
    }
  }

  // If no API base, try to return empty
  if (!API_BASE) return Promise.resolve({ results: [] });

  // Try cache first
  try {
    const cached = await idbGet(cacheKey);
    if (cached && cached.ts && (Date.now() - cached.ts) < STREET_CACHE_TTL) {
      return cached.payload;
    }
  } catch {
    // ignore idb errors
  }

  // Fetch from proxy
  const params = new URLSearchParams();
  params.set('street', q || '');
  if (city) params.set('city', city);
  if (country) params.set('country', country);
  params.set('limit', '50');
  const url = `${API_BASE.replace(/\/$/, '')}/osm/streets/?${params.toString()}`;
  const res = await fetch(url);
  const json = await res.json();

  // store in cache
  try {
    await idbSet(cacheKey, { ts: Date.now(), payload: json });
  } catch {
    // ignore cache set errors
  }
  return json;
}

// Search for complete addresses using Nominatim (OpenStreetMap)
export async function searchGlobalAddress(q: string) {
  if (!q || q.length < 3) return { results: [] };

  if (!API_BASE) return { results: [] };

  const params = new URLSearchParams();
  params.set('q', q);
  params.set('format', 'json');
  params.set('addressdetails', '1');
  params.set('limit', '10');

  // Reuse the osm/streets proxy logic but for general search
  const url = `${API_BASE.replace(/\/$/, '')}/osm/streets/?q=${encodeURIComponent(q)}&limit=10`;
  const res = await fetch(url);
  return res.json();
}

// Parse OSM address components into our form structure
export function parseOsmAddress(osmItem: any) {
  if (!osmItem || !osmItem.address) return null;
  const addr = osmItem.address;

  // Map OSM fields to our structure
  // Barangay in PH is often 'suburb', 'neighbourhood', 'village', or 'quarter'
  const barangay = addr.suburb || addr.neighbourhood || addr.village || addr.quarter || addr.hamlet || '';
  const city = addr.city || addr.town || addr.municipality || addr.city_district || '';
  const province = addr.province || addr.county || addr.state_district || '';
  const region = addr.state || addr.region || '';
  const country = addr.country_code ? addr.country_code.toUpperCase() : 'PH';
  const street = addr.road || addr.pedestrian || addr.path || '';

  return {
    barangay,
    city,
    province,
    region,
    country,
    street,
    formatted: osmItem.display_name
  };
}

// ---------------- IndexedDB simple helpers ----------------
const DB_NAME = 'ojt_address_cache_v1';
const DB_STORE = 'streets';
const OFFLINE_STORE = 'offline_streets';
const STREET_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) db.createObjectStore(OFFLINE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<any> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(key: string, value: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const r = store.put(value, key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

async function idbGetOffline(key: string): Promise<any> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readonly');
    const store = tx.objectStore(OFFLINE_STORE);
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbSetOffline(key: string, value: any): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE);
    const r = store.put(value, key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export async function clearOfflineStreets() {
  try {
    const db = await openDb();
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_STORE).clear();
    return true;
  } catch {
    return false;
  }
}

export async function listOfflineCountries(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(OFFLINE_STORE, 'readonly');
      const store = tx.objectStore(OFFLINE_STORE);
      // use getAllKeys when available
      const req = (store as any).getAllKeys ? (store as any).getAllKeys() : store.openCursor();
      if ((req as IDBRequest).onsuccess !== undefined) {
        (req as IDBRequest).onsuccess = () => {
          const keys = (req as any).result || [];
          resolve((keys as string[]).map(k => String(k)).sort((a, b) => a.localeCompare(b)));
        };
        (req as IDBRequest).onerror = () => reject((req as IDBRequest).error);
      } else {
        // fallback to cursor
        const keys: string[] = [];
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cur = cursorReq.result;
          if (cur) {
            keys.push(String(cur.key));
            cur.continue();
          } else {
            resolve(keys.sort((a, b) => a.localeCompare(b)));
          }
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      }
    } catch (err) {
      reject(err);
    }
  });
}

export async function getOfflineSummary(countryCode: string): Promise<{ country: string; citiesCount: number; hasMeta: boolean }> {
  if (!countryCode) return { country: '', citiesCount: 0, hasMeta: false };
  const code = countryCode.toUpperCase();
  try {
    const data = await idbGetOffline(code);
    if (!data) return { country: code, citiesCount: 0, hasMeta: false };
    const cities = data.cities || {};
    const citiesCount = Object.keys(cities).length;
    const hasMeta = !!data.meta;
    return { country: code, citiesCount, hasMeta };
  } catch {
    return { country: code, citiesCount: 0, hasMeta: false };
  }
}

export async function deleteOfflineCountry(countryCode: string): Promise<boolean> {
  if (!countryCode) return false;
  const code = countryCode.toUpperCase();
  try {
    const db = await openDb();
    const tx = db.transaction(OFFLINE_STORE, 'readwrite');
    tx.objectStore(OFFLINE_STORE).delete(code);
    // also remove from in-memory registry
    if (offlineStreetsRegistry[code]) delete offlineStreetsRegistry[code];
    return true;
  } catch {
    return false;
  }
}

export async function getOfflineDetails(countryCode: string, sampleLimit = 8): Promise<{ country: string; name: string; regions: string[]; sampleCities: string[] }> {
  const code = (countryCode || '').toUpperCase();
  try {
    const data = await idbGetOffline(code);
    const nameFromBundle = ((countriesCities as any).countries || []).find((c: any) => String(c.code).toUpperCase() === code)?.name;
    const name = nameFromBundle || code;
    if (!data || !data.cities) return { country: code, name, regions: [], sampleCities: [] };
    const meta = data.meta || {};
    // collect regions from meta if present
    const regionsSet = new Set<string>();
    Object.keys(meta).forEach(cityKey => {
      const m = meta[cityKey];
      if (m && m.region) regionsSet.add(String(m.region));
    });
    const regions = Array.from(regionsSet).filter(Boolean).slice(0, 50);
    // sample cities: take keys from cities object and map to display name via meta or capitalize
    const cityKeys = Object.keys(data.cities || {});
    const sampleCities = cityKeys.slice(0, sampleLimit).map(k => {
      const m = meta[k];
      return (m && m.city) ? m.city : (k && k.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '));
    });
    return { country: code, name, regions, sampleCities };
  } catch {
    return { country: code, name: code, regions: [], sampleCities: [] };
  }
}

export async function getOfflineRegionCities(countryCode: string, regionName: string): Promise<string[]> {
  if (!countryCode || !regionName) return [];
  const code = countryCode.toUpperCase();
  try {
    const data = await idbGetOffline(code);
    if (!data) return [];
    // normalized shape uses 'regions' mapping
    if (data.regions && data.regions[regionName]) return (data.regions[regionName] || []).slice().sort((a, b) => a.localeCompare(b));
    // older shape: try meta grouping
    const meta = data.meta || {};
    const cities: string[] = [];
    Object.keys(meta).forEach(k => {
      const m = meta[k];
      if (m && m.region === regionName) cities.push(m.city || k);
    });
    return cities.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

export async function clearStreetCache() {
  try {
    const db = await openDb();
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).clear();
    return true;
  } catch {
    return false;
  }
}

// ---------------- Offline address dataset (regions + cities) registry & loader ----------------
type OfflineAddressData = {
  // regions mapping: Region Name -> array of city display names
  regions?: Record<string, string[]>;
  // cities mapping: cityKey -> { city: displayName, region?: regionName }
  cities?: Record<string, { city: string; region?: string }>;
  // streets mapping: cityKey -> array of street names
  streets?: Record<string, string[]>;
  meta?: any;
};
const offlineStreetsRegistry: Record<string, OfflineAddressData> = {};

export async function loadOfflineStreets(countryCode: string): Promise<boolean> {
  if (!countryCode) return false;
  const code = countryCode.toUpperCase();
  if (offlineStreetsRegistry[code]) return true;
  try {
    // First attempt to load persisted dataset from IndexedDB
    try {
      const persisted = await idbGetOffline(code);
      if (persisted && (persisted.cities || persisted.regions)) {
        // persisted may be older format or new format
        const normalized = normalizeOfflineData(persisted);
        offlineStreetsRegistry[code] = normalized;
        return true;
      }
    } catch {
      // ignore idb read errors and fall through to dynamic import
    }

    // Attempt dynamic import from src/app/data/streets/{CODE}.json
    // Note: the file must exist; bundlers may need the files present during build.
    // This will fail gracefully if file is not present.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const mod = await import(`../data/streets/${code}.json`);
    const data = (mod && mod.default) ? mod.default : mod;
    if (data && (data.cities || data.regions)) {
      const normalized = normalizeOfflineData(data);
      offlineStreetsRegistry[code] = normalized;
      // persist normalized for future
      try { await idbSetOffline(code, normalized); } catch { }
      return true;
    }
  } catch (err) {
    // file not found or import error
  }
  return false;
}

export function registerOfflineStreets(countryCode: string, data: any) {
  if (!countryCode || !data) return false;
  const code = countryCode.toUpperCase();
  const normalized = normalizeOfflineData(data);
  offlineStreetsRegistry[code] = normalized;
  // persist normalized to IndexedDB for offline use
  try {
    idbSetOffline(code, normalized).catch(() => { });
  } catch {
    // ignore
  }
  return true;
}

function normalizeOfflineData(raw: any): OfflineAddressData {
  // If already in new format, return as-is
  if (raw && (raw.regions || raw.cities)) {
    // Normalize cities mapping if cities is an array->streets old format
    const out: OfflineAddressData = { regions: {}, cities: {}, meta: raw.meta || {} };
    if (raw.regions && typeof raw.regions === 'object') {
      // expected regions: { regionName: [cityNames...] }
      out.regions = {};
      Object.keys(raw.regions).forEach(r => {
        out.regions![r] = Array.isArray(raw.regions[r]) ? raw.regions[r].slice() : [];
        out.regions![r].sort((a, b) => a.localeCompare(b));
      });
      // build cities map from regions
      out.cities = {};
      Object.entries(out.regions).forEach(([r, cities]) => {
        cities.forEach(c => {
          const key = c.trim().toLowerCase().replace(/\s+/g, '-');
          out.cities![key] = { city: c, region: r };
        });
      });
      return out;
    }

    // older format: raw.cities: { cityKey: [streets...] } with raw.meta providing city display and region
    if (raw.cities && typeof raw.cities === 'object') {
      out.cities = {};
      out.regions = {};
      out.streets = {};
      const meta = raw.meta || {};
      Object.keys(raw.cities).forEach(cityKey => {
        // If the value is an array, it's streets
        if (Array.isArray(raw.cities[cityKey])) {
          out.streets![cityKey] = raw.cities[cityKey].slice();
        }

        const cityName = (meta[cityKey] && meta[cityKey].city) ? meta[cityKey].city : cityKey.split('-').map(p=>p.charAt(0).toUpperCase()+p.slice(1)).join(' ');
        const region = (meta[cityKey] && meta[cityKey].region) ? meta[cityKey].region : 'Unknown';
        out.cities![cityKey] = { city: cityName, region };
        out.regions![region] = out.regions![region] || [];
        if (!out.regions![region].includes(cityName)) out.regions![region].push(cityName);
      });
      // sort regions and city lists
      Object.keys(out.regions).forEach(r => out.regions![r].sort((a,b)=>a.localeCompare(b)));
      return out;
    }
  }
  // unknown/raw shape -> empty
  return { regions: {}, cities: {}, meta: raw && raw.meta ? raw.meta : {} };
}

// Parse Geonames result into a simple street/city/country structure
export function parsePlaceComponents(details: any) {
  if (!details) return {};
  // Geonames getJSON returns properties like name, countryCode, adminName1, adminName2
  const name = details.name || details.toponymName || '';
  const admin1 = details.adminName1 || '';
  const admin2 = details.adminName2 || '';
  const country = details.countryCode || details.countryCode || '';
  const formattedParts = [name, admin2 || admin1, country].filter(Boolean);
  return {
    street: name || undefined,
    city: admin2 || admin1 || undefined,
    country: country || undefined,
    formatted: formattedParts.join(', '),
  };
}

export default {
  autocompletePlaces,
  getPlaceDetails,
  parsePlaceComponents,
  getCountries,
  searchGlobalAddress,
  parseOsmAddress,
  loadOfflineStreets,
  registerOfflineStreets,
  clearStreetCache,
  clearOfflineStreets,
  listOfflineCountries,
  getOfflineSummary,
  deleteOfflineCountry,
  getOfflineDetails,
  getOfflineRegionCities,
};
