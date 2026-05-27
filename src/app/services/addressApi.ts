// Geonames wrapper used for address autocomplete in the Register page.
// Requires `VITE_GEONAMES_USERNAME` to be set in the frontend environment.

import countriesCities from '../data/countries_cities.json';
import { addressDb } from '../lib/db';
import { 
  IndexedCity, 
  GeonamesResponse, 
  GeonameItem, 
  OsmItem, 
  NormalizedAddress, 
  OfflineAddressData, 
  CacheEntry 
} from './addressTypes';

import { API_BASE } from './config';

let cityIndex: IndexedCity[] = [];

function buildCityIndex() {
  if (cityIndex.length > 0) return;
  const allCities: IndexedCity[] = [];
  const typedData = countriesCities as { countries: { code: string, cities: { name: string, population: number, lat: number, lon: number }[] }[] };
  
  typedData.countries.forEach((c) => {
    c.cities.forEach((ct) => {
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
  allCities.sort((a, b) => b.population - a.population);
  cityIndex = allCities;
}

export async function autocompletePlaces(input: string): Promise<GeonamesResponse> {
  if (!input || input.length < 2) return { geonames: [] };
  if (!API_BASE) {
    buildCityIndex();
    const q = input.toLowerCase();
    const matches = cityIndex
      .filter((c) => c.nameLower.includes(q) || c.nameLower.startsWith(q))
      .slice(0, 10)
      .map((c) => ({ name: c.name, countryCode: c.countryCode, population: c.population }));
    return { geonames: matches };
  }
  const q = encodeURIComponent(input);
  const url = `${API_BASE.replace(/\/$/, '')}/geonames/proxy/?q=${q}&maxRows=10`;
  const res = await fetch(url);
  return res.json();
}

export async function getPlaceDetails(geonameId: string | number): Promise<GeonameItem | null> {
  if (!geonameId || !API_BASE) return null;
  const url = `${API_BASE.replace(/\/$/, '')}/geonames/proxy/?geonameId=${encodeURIComponent(String(geonameId))}`;
  const res = await fetch(url);
  return res.json();
}

export async function getCountries(): Promise<GeonamesResponse> {
  const typedData = countriesCities as { countries: { code: string }[] };
  const base = (typedData.countries || []).map(c => ({
    code: c.code,
    countryCode: c.code,
    name: new Intl.DisplayNames(['en'], { type: 'region' }).of(c.code) || c.code
  }));
  if (!API_BASE) {
    try {
      const offline = await listOfflineCountries();
      const missing = (offline || []).filter(
        (c: string) => !base.find((b) => String(b.code).toUpperCase() === String(c).toUpperCase())
      );
      const added = missing.map((c: string) => ({ 
        name: new Intl.DisplayNames(['en'], { type: 'region' }).of(c) || c, 
        code: c,
        countryCode: c
      }));
      return { geonames: base.concat(added as any) };
    } catch {
      return { geonames: base as any };
    }
  }
  const url = `${API_BASE.replace(/\/$/, '')}/geonames/countries/`;
  const res = await fetch(url);
  return res.json();
}

export async function searchCities(country: string, q: string): Promise<GeonamesResponse> {
  if (!API_BASE) {
    buildCityIndex();
    const countryCode = country.toUpperCase();
    let results = cityIndex.filter((c) => c.countryCode === countryCode);

    if (q) {
      const queryLower = q.toLowerCase();
      results = results.filter((c) => c.nameLower.includes(queryLower) || c.nameLower.startsWith(queryLower));
    }

    const out = results.slice(0, 50).map((c) => ({
      name: c.name,
      countryCode: c.countryCode,
      population: c.population,
      lat: c.lat,
      lon: c.lon,
    }));
    return { geonames: out };
  }
  const url = `${API_BASE.replace(/\/$/, '')}/geonames/cities/?q=${encodeURIComponent(q || '')}&country=${encodeURIComponent(country || '')}&maxRows=50`;
  const res = await fetch(url);
  return res.json();
}

const STREET_CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

export async function searchStreets(country: string, city: string, q: string) {
  const cacheKey = `streets:${(country || '').toUpperCase()}:${(city || '').toLowerCase()}:${(q || '').toLowerCase()}`;
  const countryCode = (country || '').toUpperCase();

  if (offlineStreetsRegistry[countryCode]) {
    try {
      const data = offlineStreetsRegistry[countryCode];
      const cityKey = (city || '').toLowerCase();
      const cityStreets = data.streets && data.streets[cityKey] ? data.streets[cityKey] : [];
      const qLower = (q || '').toLowerCase();
      const filtered = qLower ? cityStreets.filter((s) => s.toLowerCase().includes(qLower)) : cityStreets.slice();
      const sorted = filtered.slice().sort((a, b) => a.localeCompare(b));
      return { results: sorted.map((s) => ({ display_name: s, name: s })) };
    } catch { /* fallback */ }
  }

  if (!API_BASE) return { results: [] };

  try {
    const cached = await addressDb.get<CacheEntry<any>>('streets', cacheKey);
    if (cached && Date.now() - cached.ts < STREET_CACHE_TTL) {
      return cached.payload;
    }
  } catch { /* ignore */ }

  const params = new URLSearchParams();
  params.set('street', q || '');
  if (city) params.set('city', city);
  if (country) params.set('country', country);
  params.set('limit', '50');
  const url = `${API_BASE.replace(/\/$/, '')}/osm/streets/?${params.toString()}`;
  const res = await fetch(url);
  const json = await res.json();

  try {
    await addressDb.set('streets', cacheKey, { ts: Date.now(), payload: json });
  } catch { /* ignore */ }
  return json;
}

export async function searchGlobalAddress(q: string) {
  if (!q || q.length < 3 || !API_BASE) return { results: [] };
  const url = `${API_BASE.replace(/\/$/, '')}/osm/streets/?q=${encodeURIComponent(q)}&limit=10`;
  const res = await fetch(url);
  return res.json();
}

export function parseOsmAddress(osmItem: OsmItem): NormalizedAddress | null {
  if (!osmItem || !osmItem.address) return null;
  const addr = osmItem.address;

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
    formatted: osmItem.display_name,
  };
}

export async function clearOfflineStreets() {
  try {
    await addressDb.clear('offline_streets');
    return true;
  } catch { return false; }
}

export async function listOfflineCountries(): Promise<string[]> {
  try {
    const keys = await addressDb.getAllKeys('offline_streets');
    return keys.map(k => String(k)).sort((a, b) => a.localeCompare(b));
  } catch { return []; }
}

export async function getOfflineSummary(countryCode: string) {
  if (!countryCode) return { country: '', citiesCount: 0, hasMeta: false };
  const code = countryCode.toUpperCase();
  try {
    const data = await addressDb.get<OfflineAddressData>('offline_streets', code);
    if (!data) return { country: code, citiesCount: 0, hasMeta: false };
    const citiesCount = Object.keys(data.cities || {}).length;
    return { country: code, citiesCount, hasMeta: !!data.meta };
  } catch { return { country: code, citiesCount: 0, hasMeta: false }; }
}

export async function deleteOfflineCountry(countryCode: string): Promise<boolean> {
  if (!countryCode) return false;
  const code = countryCode.toUpperCase();
  try {
    await addressDb.delete('offline_streets', code);
    if (offlineStreetsRegistry[code]) delete offlineStreetsRegistry[code];
    return true;
  } catch { return false; }
}

export async function getOfflineDetails(countryCode: string, sampleLimit = 8) {
  const code = (countryCode || '').toUpperCase();
  try {
    const data = await addressDb.get<OfflineAddressData>('offline_streets', code);
    const typedData = countriesCities as { countries: { code: string }[] };
    const countries = typedData.countries || [];
    const countryObj = countries.find((c) => String(c.code).toUpperCase() === code);
    const name = countryObj ? (new Intl.DisplayNames(['en'], { type: 'region' }).of(countryObj.code) || countryObj.code) : code;
    if (!data || !data.cities) return { country: code, name, regions: [], sampleCities: [] };
    
    const regionsSet = new Set<string>();
    Object.values(data.meta || {}).forEach((m) => {
      const meta = m as { region?: string };
      if (meta?.region) regionsSet.add(meta.region);
    });
    const regions = Array.from(regionsSet).slice(0, 50);
    
    const sampleCities = Object.keys(data.cities || {}).slice(0, sampleLimit).map(k => {
      const m = data.meta?.[k];
      return m?.city || k.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    });
    return { country: code, name, regions, sampleCities };
  } catch { return { country: code, name: code, regions: [], sampleCities: [] }; }
}

export async function getOfflineRegionCities(countryCode: string, regionName: string): Promise<string[]> {
  if (!countryCode || !regionName) return [];
  const code = countryCode.toUpperCase();
  try {
    const data = await addressDb.get<OfflineAddressData>('offline_streets', code);
    if (!data) return [];
    if (data.regions?.[regionName]) return [...data.regions[regionName]].sort((a, b) => a.localeCompare(b));
    
    const cities: string[] = [];
    Object.keys(data.meta || {}).forEach(k => {
      if (data.meta[k]?.region === regionName) cities.push(data.meta[k].city || k);
    });
    return cities.sort((a, b) => a.localeCompare(b));
  } catch { return []; }
}

export async function clearStreetCache() {
  try {
    await addressDb.clear('streets');
    return true;
  } catch { return false; }
}

const offlineStreetsRegistry: Record<string, OfflineAddressData> = {};

export async function loadOfflineStreets(countryCode: string): Promise<boolean> {
  if (!countryCode) return false;
  const code = countryCode.toUpperCase();
  if (offlineStreetsRegistry[code]) return true;
  
  try {
    const persisted = await addressDb.get<OfflineAddressData>('offline_streets', code);
    if (persisted && (persisted.cities || persisted.regions)) {
      offlineStreetsRegistry[code] = normalizeOfflineData(persisted);
      return true;
    }
    
    const mod = await import(`../data/streets/${code}.json`);
    const data = mod?.default || mod;
    if (data && (data.cities || data.regions)) {
      const normalized = normalizeOfflineData(data);
      offlineStreetsRegistry[code] = normalized;
      await addressDb.set('offline_streets', code, normalized);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

export function registerOfflineStreets(countryCode: string, data: Partial<OfflineAddressData>) {
  if (!countryCode || !data) return false;
  const code = countryCode.toUpperCase();
  const normalized = normalizeOfflineData(data);
  offlineStreetsRegistry[code] = normalized;
  addressDb.set('offline_streets', code, normalized).catch(() => {});
  return true;
}

function normalizeOfflineData(raw: any): OfflineAddressData {
  if (!raw) return { regions: {}, cities: {}, meta: {} };
  
  const out: OfflineAddressData = { 
    regions: {}, 
    cities: {}, 
    streets: {}, 
    meta: raw.meta || {} 
  };

  // If we have regions (array of cities per region)
  if (raw.regions && typeof raw.regions === 'object') {
    Object.keys(raw.regions).forEach(r => {
      const citiesInRegion = Array.isArray(raw.regions[r]) ? raw.regions[r] : [];
      out.regions![r] = [...citiesInRegion].sort((a, b) => a.localeCompare(b));
      
      citiesInRegion.forEach((c: string) => {
        const key = c.trim().toLowerCase().replace(/\s+/g, '-');
        out.cities![key] = { city: c, region: r };
      });
    });
  }

  // If we have cities (which might be an array of streets OR a metadata object)
  if (raw.cities && typeof raw.cities === 'object') {
    const rawCities = raw.cities as Record<string, any>;
    const meta = raw.meta || {};
    
    Object.keys(rawCities).forEach(cityKey => {
      const data = rawCities[cityKey];
      
      // If the city data is an array, it's a list of streets
      if (Array.isArray(data)) {
        out.streets![cityKey] = [...data];
        
        // Ensure city exists in metadata/regions
        const cityName = meta[cityKey]?.city || cityKey.split('-').map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        const region = meta[cityKey]?.region || 'Unknown';
        
        if (!out.cities![cityKey]) {
          out.cities![cityKey] = { city: cityName, region };
          out.regions![region] = out.regions![region] || [];
          if (!out.regions![region].includes(cityName)) out.regions![region].push(cityName);
        }
      } 
      // If it's a metadata object (the normalized format)
      else if (data && typeof data === 'object') {
        out.cities![cityKey] = { 
          city: data.city || cityKey, 
          region: data.region || 'Unknown' 
        };
      }
    });
  }

  // Final sort for regions
  if (out.regions) {
    Object.keys(out.regions).forEach(r => out.regions![r].sort((a, b) => a.localeCompare(b)));
  }

  return out;
}

export function parsePlaceComponents(details: any) {
  if (!details) return {};
  const name = details.name || details.toponymName || '';
  const admin1 = details.adminName1 || '';
  const admin2 = details.adminName2 || '';
  const country = details.countryCode || '';
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
