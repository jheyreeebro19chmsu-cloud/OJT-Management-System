export interface CampusLocationInfo {
  campus: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius: number;
}

export const CHMSU_CAMPUS_LOCATIONS: Record<string, CampusLocationInfo> = {
  'Talisay Campus': {
    campus: 'Talisay Campus',
    name: 'CHMSU Talisay (Main Campus)',
    address: 'Carlos Hilado Memorial State University - Talisay Campus, Mabini St., Talisay City, Negros Occidental, Philippines',
    lat: 10.7410,
    lng: 122.9702,
    radius: 40,
  },
  'Alijis Campus': {
    campus: 'Alijis Campus',
    name: 'CHMSU Alijis Campus',
    address: 'Carlos Hilado Memorial State University - Alijis Campus, Alijis Road, Bacolod City, Negros Occidental, Philippines',
    lat: 10.6387,
    lng: 122.9692,
    radius: 40,
  },
  'Fortune Towne Campus': {
    campus: 'Fortune Towne Campus',
    name: 'CHMSU Fortune Towne Campus',
    address: 'Carlos Hilado Memorial State University - Fortune Towne Campus, Bacolod City, Negros Occidental, Philippines',
    lat: 10.6728,
    lng: 122.9890,
    radius: 40,
  },
  'Binalbagan Campus': {
    campus: 'Binalbagan Campus',
    name: 'CHMSU Binalbagan Campus',
    address: 'Carlos Hilado Memorial State University - Binalbagan Campus, Enclaro, Binalbagan, Negros Occidental, Philippines',
    lat: 10.1948,
    lng: 122.8581,
    radius: 40,
  },
};

export function getCampusLocation(campusName?: string): CampusLocationInfo {
  if (!campusName) return CHMSU_CAMPUS_LOCATIONS['Talisay Campus'];
  const clean = campusName.toLowerCase();
  for (const [key, val] of Object.entries(CHMSU_CAMPUS_LOCATIONS)) {
    if (clean.includes(key.toLowerCase()) || key.toLowerCase().includes(clean)) {
      return val;
    }
  }
  return CHMSU_CAMPUS_LOCATIONS['Talisay Campus'];
}
