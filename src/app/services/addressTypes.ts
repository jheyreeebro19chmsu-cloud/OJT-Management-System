export interface IndexedCity {
  name: string;
  countryCode: string;
  population: number;
  lat: number;
  lon: number;
  nameLower: string;
}

export interface GeonamesResponse {
  geonames: GeonameItem[];
}

export interface GeonameItem {
  geonameId?: number | string;
  name: string;
  toponymName?: string;
  countryCode: string;
  population?: number;
  lat?: number;
  lon?: number;
  adminName1?: string;
  adminName2?: string;
}

export interface OsmAddress {
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  quarter?: string;
  hamlet?: string;
  city?: string;
  town?: string;
  municipality?: string;
  city_district?: string;
  province?: string;
  county?: string;
  state_district?: string;
  state?: string;
  region?: string;
  country_code?: string;
  road?: string;
  pedestrian?: string;
  path?: string;
}

export interface OsmItem {
  display_name: string;
  address: OsmAddress;
}

export interface NormalizedAddress {
  barangay: string;
  city: string;
  province: string;
  region: string;
  country: string;
  street: string;
  formatted: string;
}

export interface OfflineAddressData {
  regions?: Record<string, string[]>;
  cities?: Record<string, { city: string; region?: string }>;
  streets?: Record<string, string[]>;
  meta?: any;
}

export interface CacheEntry<T> {
  ts: number;
  payload: T;
}
