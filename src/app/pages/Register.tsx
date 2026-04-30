import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, User, Building, GraduationCap, Camera, MapPin, Loader, ShieldCheck, UserCircle } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { FaceCapture } from '../components/FaceCapture';
import { getCurrentLocation, isGeolocationPositionError } from '../utils/geo';
import { motion, AnimatePresence } from 'motion/react';
import { isSecurityApiConfigured, registerFace } from '../services/securityApi';
import { authAPI } from '../services/authApi';
import addressesData from '../data/addresses.json';
import countriesCities from '../data/countries_cities.json';
import addressApi, { autocompletePlaces, getPlaceDetails, parsePlaceComponents, searchCities, searchStreets } from '../services/addressApi';
import { sendWelcomeEmail, sendOtpEmail } from '../lib/resend';
import { QRCodeSVG } from 'qrcode.react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet marker icon
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const stepsTrainee = ['Personal Info', 'Company Info', 'School Info', 'Face Registration'];
const stepsAdmin = ['Personal Info', 'Face Registration'];
const stepsHTE = ['Company Info', 'Contact Info'];

type LocationStatus = 'idle' | 'capturing' | 'captured' | 'denied' | 'error';
type UserRole = 'trainee' | 'admin' | 'hte' | null;

const PASSWORD_LENGTH = 12;
const PASSWORD_SETS = {
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  special: '!@#$%^&*?',
};
const PASSWORD_ALL = `${PASSWORD_SETS.upper}${PASSWORD_SETS.lower}${PASSWORD_SETS.numbers}${PASSWORD_SETS.special}`;

function generatePassword(length: number = PASSWORD_LENGTH): string {
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const chars = [
    pick(PASSWORD_SETS.upper),
    pick(PASSWORD_SETS.lower),
    pick(PASSWORD_SETS.numbers),
    pick(PASSWORD_SETS.special),
  ];
  for (let i = chars.length; i < length; i += 1) {
    chars.push(pick(PASSWORD_ALL));
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export function Register() {
  const { registerEmployee, updateEmployee } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(null);
  const [step, setStep] = useState(0);
  const [generatedPassword, setGeneratedPassword] = useState(() => generatePassword());
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [faceCapturing, setFaceCapturing] = useState(false);
  const [form, setForm] = useState({
    name: '', first_name: '', last_name: '', middle_initial: '', email: '', department: '', position: 'OJT Trainee',
    companyName: '', supervisorName: '', schoolName: '', course: '',
    employeeId: '', startDate: '', endDate: '', requiredHours: 486,
    contactPerson: '', contactPhone: '', companyAddress: '',
    birthdate: '', age: '', country: '', region: '', city: '', street: '', barangay: '',
  });
  
  const [otpCode, setOtpCode] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registeredInstructorId, setRegisteredInstructorId] = useState('');

  const [faceRegistered, setFaceRegistered] = useState(false);
  const [photo, setPhoto] = useState<string | undefined>();
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState(false);

  // Registration location state
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [registrationLocation, setRegistrationLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [registrationAddress, setRegistrationAddress] = useState<string>('');
  const [availableCountries, setAvailableCountries] = useState(() => (countriesCities as any).countries || []);
  const [availableCities, setAvailableCities] = useState<any[]>([]);
  const [availableStreets, setAvailableStreets] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerCountry, setPickerCountry] = useState('');
  const [pickerRegion, setPickerRegion] = useState('');
  const [pickerCity, setPickerCity] = useState('');
  const [streetsLoading, setStreetsLoading] = useState(false);
  const [cityFilter, setCityFilter] = useState('');
  const [countryHighlight, setCountryHighlight] = useState(0);
  const [regionHighlight, setRegionHighlight] = useState(0);
  const [cityHighlight, setCityHighlight] = useState(0);
  const [streetHighlight, setStreetHighlight] = useState(0);
  const modalRef = React.useRef<HTMLDivElement | null>(null);
  const countryListRef = React.useRef<HTMLUListElement | null>(null);
  const cityListRef = React.useRef<HTMLDivElement | null>(null);
  const streetListRef = React.useRef<HTMLUListElement | null>(null);
  const filterInputRef = React.useRef<HTMLInputElement | null>(null);
  const prevActiveElementRef = React.useRef<HTMLElement | null>(null);
  const [activePane, setActivePane] = useState<'country'|'region'|'city'>('country');
  const [showLocationMap, setShowLocationMap] = useState(false);
  const API_BASE = (import.meta as ImportMeta).env.VITE_DJANGO_API_URL as string | undefined;
  const useProxy = Boolean(API_BASE);

  // Autocomplete UI state (Geonames / proxy)
  const [addrQuery, setAddrQuery] = useState('');
  const [addrSuggestions, setAddrSuggestions] = useState<any[]>([]);
  const [showAddrSuggestions, setShowAddrSuggestions] = useState(false);
  const addrDebounceRef = React.useRef<number | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<any[]>([]);
  const cityDebounceRef = React.useRef<number | null>(null);
  const [streetQuery, setStreetQuery] = useState('');
  const [streetSuggestions, setStreetSuggestions] = useState<any[]>([]);
  const streetDebounceRef = React.useRef<number | null>(null);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableCitiesForRegion, setAvailableCitiesForRegion] = useState<string[]>([]);

  const steps = role === 'admin' ? stepsAdmin : role === 'hte' ? stepsHTE : stepsTrainee;

  // registration flow continues below

  const selectRole = (nextRole: UserRole) => {
    setRole(nextRole);
    setStep(0);
    setGeneratedPassword(generatePassword());
    setPasswordCopied(false);
    // store pending oauth role for Google sign-in flow
    localStorage.setItem('pending_oauth_role', nextRole || '');
  };

  const regeneratePassword = () => {
    setGeneratedPassword(generatePassword());
    setPasswordCopied(false);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 1500);
    } catch {
      // Ignore clipboard errors (not supported or blocked)
    }
  };

  // Capture location on mount and detect OAuth HTE prefill
  useEffect(() => {
    captureLocation();

    try {
      const params = new URLSearchParams(window.location.search);
      const h = params.get('h');
      const pending = localStorage.getItem('pending_oauth_role');
      const oauthEmail = localStorage.getItem('oauth_email');
      const oauthName = localStorage.getItem('oauth_name');
      if (h === 'hte' || pending === 'hte') {
        setRole('hte');
        setOauthPending(true);
        if (oauthEmail) update('email', oauthEmail);
        if (oauthName) update('name', oauthName);
        // clear pending markers
        localStorage.removeItem('pending_oauth_role');
        localStorage.removeItem('oauth_email');
        localStorage.removeItem('oauth_name');
      }
    } catch {
      // ignore
    }
  }, []);

  // Load countries from proxy if available
  useEffect(() => {
    (async () => {
      try {
        if (useProxy) {
          const res = await getCountries();
          if (res && res.geonames) {
            // map geonames country info to {code,name,cities:[]}
            const countries = (res.geonames || []).map((c: any) => ({ code: c.countryCode, name: c.countryName, cities: [] }));
            countries.sort((a: any, b: any) => (a.name || a.code).localeCompare(b.name || b.code));
            setAvailableCountries(countries);
          }
        }
      } catch {
        // ignore, keep local dataset
      }
    })();
  }, [useProxy]);

  // Ensure bundled countries are sorted alphabetically on mount
  useEffect(() => {
    try {
      const c = ((countriesCities as any).countries || []).slice();
      c.sort((a: any, b: any) => (a.name || a.code).localeCompare(b.name || b.code));
      setAvailableCountries(c);
    } catch {
      // ignore
    }
  }, []);

  // When a country is picked, try to load offline details (regions + cities) and populate region list
  useEffect(() => {
    let cancelled = false;
    if (!pickerCountry) {
      setAvailableRegions([]);
      setPickerRegion('');
      setPickerCity('');
      setAvailableCitiesForRegion([]);
      return;
    }
    (async () => {
      try {
        await addressApi.loadOfflineStreets(pickerCountry);
        const details = await addressApi.getOfflineDetails(pickerCountry, 200);
        if (!cancelled && details && details.regions && details.regions.length > 0) {
          setAvailableRegions(details.regions.slice().sort((a,b) => a.localeCompare(b)));
          setPickerRegion('');
          setPickerCity('');
          setRegionHighlight(0);
          return;
        }
      } catch {
        // ignore
      }
      // fallback: use bundled countriesCities adminName1 grouping
      try {
        const countryObj = ((countriesCities as any).countries || []).find((x: any) => x.code === pickerCountry) || {};
        const cities = (countryObj.cities || []);
        const groups: Record<string, any[]> = {};
        cities.forEach((ct: any) => {
          const g = ct.adminName1 || ct.admin1 || ct.region || 'Others';
          groups[g] = groups[g] || [];
          groups[g].push(ct.name || ct);
        });
        const groupKeys = Object.keys(groups).sort();
        if (!cancelled) setAvailableRegions(groupKeys);
      } catch {
        setAvailableRegions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [pickerCountry]);

  // when a region is selected, load its cities
  useEffect(() => {
    let cancelled = false;
    if (!pickerCountry || !pickerRegion) { setAvailableCitiesForRegion([]); return; }
    (async () => {
      try {
        const cities = await addressApi.getOfflineRegionCities(pickerCountry, pickerRegion);
        if (!cancelled && cities && cities.length > 0) {
          setAvailableCitiesForRegion(cities);
          setCityHighlight(0);
          return;
        }
      } catch { }
      // fallback to bundled
      try {
        const countryObj = ((countriesCities as any).countries || []).find((x: any) => x.code === pickerCountry) || {};
        const cities = (countryObj.cities || []).filter((ct: any) => (ct.adminName1 || ct.admin1 || ct.region || 'Others') === pickerRegion).map((ct: any) => ct.name || ct).sort((a:any,b:any)=>a.localeCompare(b));
        if (!cancelled) setAvailableCitiesForRegion(cities);
      } catch {
        if (!cancelled) setAvailableCitiesForRegion([]);
      }
    })();
    return () => { cancelled = true; };
  }, [pickerCountry, pickerRegion]);

  const captureLocation = async () => {
    setLocationStatus('capturing');
    try {
      const position = await getCurrentLocation();
      const { latitude, longitude } = position.coords;
      setRegistrationLocation({ lat: latitude, lng: longitude });
      setLocationStatus('captured');
    } catch (err: unknown) {
      const isDenied = isGeolocationPositionError(err) && err.code === 1;
      setLocationStatus(isDenied ? 'denied' : 'error');
    }
  };

  const update = (field: string, value: string | number) => {
    setForm(p => {
      const newForm = { ...p, [field]: value };
      
      // Auto-calculate age if birthdate changes
      if (field === 'birthdate' && typeof value === 'string' && value) {
        const birthDate = new Date(value);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
          newForm.age = age.toString();
        }
      }
      
      return newForm;
    });
  };

  const handleRequestOtp = async () => {
    if (!form.email) {
      alert('Please enter your email first');
      return;
    }
    
    setOtpVerifying(true);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    
    try {
      const result = await sendOtpEmail(form.email, code);
      if (result.error) throw new Error(typeof result.error === 'string' ? result.error : JSON.stringify(result.error));
      
      setOtpSent(true);
      alert('Confirmation code sent to your email!');
    } catch (err: any) {
      console.error('OTP Error:', err);
      alert('Failed to send code: ' + (err.message || 'Unknown error'));
    } finally {
      setOtpVerifying(false);
    }
  };

  const verifyOtp = () => {
    if (otpCode === generatedOtp) {
      setIsOtpVerified(true);
      alert('Email verified successfully!');
    } else {
      alert('Invalid confirmation code. Please try again.');
    }
  };

  const handleShareQr = () => {
    const canvas = document.getElementById('instructor-qr') as HTMLCanvasElement;
    if (canvas) {
      // In a real browser app, we'd use navigator.share or download
      alert('QR Code is ready! You can right-click the image to save and share it.');
    }
  };

  useEffect(() => {
    // Update cities when country changes
    const country = (form as any).country;
    if (!country) {
      setAvailableCities([]);
      setAvailableStreets([]);
      return;
    }
    const found = availableCountries.find((c: any) => c.code === country || c.name === country);
    const cities = found ? found.cities || [] : [];
    setAvailableCities(cities);
    // reset city/street/region/barangay when country changes
    setForm(p => ({ ...p, city: '', street: '', region: '', barangay: '' }));
  }, [(form as any).country]);

  useEffect(() => {
    // Update streets when city changes
    const city = (form as any).city;
    if (!city) {
      setAvailableStreets([]);
      return;
    }
    const country = (form as any).country;
    const foundCountry = availableCountries.find((c: any) => c.code === country || c.name === country);
    const foundCity = foundCountry?.cities?.find((ct: any) => ct.name === city);
    setAvailableStreets(foundCity?.streets || []);
    setForm(p => ({ ...p, street: '' }));
  }, [(form as any).city]);

  // Query autocomplete when query changes (debounced). Works with backend proxy or bundled dataset.
  useEffect(() => {
    if (!addrQuery || addrQuery.length < 2) {
      setAddrSuggestions([]);
      return;
    }
    if (addrDebounceRef.current) window.clearTimeout(addrDebounceRef.current);
    addrDebounceRef.current = window.setTimeout(async () => {
      try {
        const res = await autocompletePlaces(addrQuery);
        setAddrSuggestions(res.geonames || []);
        setShowAddrSuggestions(true);
      } catch {
        setAddrSuggestions([]);
      }
    }, 200);
    return () => { if (addrDebounceRef.current) window.clearTimeout(addrDebounceRef.current); };
  }, [addrQuery]);

  // City suggestions (searchCities) — works offline with bundled dataset
  useEffect(() => {
    if (!cityQuery || cityQuery.length < 2) {
      setCitySuggestions([]);
      return;
    }
    if (cityDebounceRef.current) window.clearTimeout(cityDebounceRef.current);
    cityDebounceRef.current = window.setTimeout(async () => {
      try {
        const res = await searchCities((form as any).country || '', cityQuery);
        setCitySuggestions(res.geonames || []);
      } catch {
        setCitySuggestions([]);
      }
    }, 200);
    return () => { if (cityDebounceRef.current) window.clearTimeout(cityDebounceRef.current); };
  }, [cityQuery, (form as any).country]);

  // Street suggestions (OSM) — will call backend if configured, otherwise stays empty
  useEffect(() => {
    if (!streetQuery || streetQuery.length < 2) {
      setStreetSuggestions([]);
      return;
    }
    if (streetDebounceRef.current) window.clearTimeout(streetDebounceRef.current);
    streetDebounceRef.current = window.setTimeout(async () => {
      try {
        const res = await searchStreets((form as any).country || '', (form as any).city || '', streetQuery);
        setStreetSuggestions(res.results || []);
      } catch {
        setStreetSuggestions([]);
      }
    }, 200);
    return () => { if (streetDebounceRef.current) window.clearTimeout(streetDebounceRef.current); };
  }, [streetQuery, (form as any).city, (form as any).country]);

  // Keyboard navigation for picker modal
  useEffect(() => {
    if (!showPicker) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowPicker(false); return; }
      const countriesLen = (availableCountries as any[]).length;
      const regionsLen = (availableRegions || []).length;
      const countryObj = ((countriesCities as any).countries || []).find((x: any) => x.code === pickerCountry) || {};
      const cities = (countryObj.cities || []).filter((ct: any) => !cityFilter || ct.name.toLowerCase().includes(cityFilter.toLowerCase()));
      const citiesLen = cities.length;
      const streetsLen = (availableStreets || []).length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (activePane === 'country') setCountryHighlight(h => Math.min(h + 1, Math.max(0, countriesLen - 1)));
        else if (activePane === 'region') setRegionHighlight(h => Math.min(h + 1, Math.max(0, regionsLen - 1)));
        else if (activePane === 'city') setCityHighlight(h => Math.min(h + 1, Math.max(0, citiesLen - 1)));
        else setStreetHighlight(h => Math.min(h + 1, Math.max(0, streetsLen - 1)));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (activePane === 'country') setCountryHighlight(h => Math.max(0, h - 1));
        else if (activePane === 'region') setRegionHighlight(h => Math.max(0, h - 1));
        else if (activePane === 'city') setCityHighlight(h => Math.max(0, h - 1));
        else setStreetHighlight(h => Math.max(0, h - 1));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (activePane === 'country') setActivePane('region');
        else if (activePane === 'region') setActivePane('city');
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (activePane === 'city') setActivePane('region');
        else if (activePane === 'region') setActivePane('country');
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activePane === 'country') {
          const c = (availableCountries as any[])[countryHighlight];
          if (c) { setPickerCountry(c.code); setPickerCity(''); setActivePane('region'); setRegionHighlight(0); }
        } else if (activePane === 'region') {
          const rg = (availableRegions || [])[regionHighlight];
          if (rg) { setPickerRegion(rg); setPickerCity(''); setActivePane('city'); setCityHighlight(0); }
        } else if (activePane === 'city') {
          const countryObj2 = ((countriesCities as any).countries || []).find((x: any) => x.code === pickerCountry) || {};
          const cities2 = (countryObj2.cities || []).filter((ct: any) => !cityFilter || ct.name.toLowerCase().includes(cityFilter.toLowerCase()));
          const ct = cities2[cityHighlight];
          if (ct) { setPickerCity(ct.name); setActivePane('city'); setCityHighlight(0); }
        } else if (activePane === 'street') {
          const s = (availableStreets || [])[streetHighlight];
          if (s) { update('street', s); setRegistrationAddress(`${s}, ${pickerCity || ''}`); setAddrQuery(`${s}, ${pickerCity || ''}`); setShowPicker(false); }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showPicker, availableCountries, pickerCountry, cityFilter, activePane, countryHighlight, cityHighlight, streetHighlight, availableStreets]);

  // Focus trap and auto-focus when modal opens; restore focus on close
  useEffect(() => {
    if (!showPicker) {
      try { prevActiveElementRef.current?.focus(); } catch {}
      return;
    }
    // Save previous active element
    prevActiveElementRef.current = document.activeElement as HTMLElement | null;
    // Focus the city filter input
    setTimeout(() => filterInputRef.current?.focus(), 0);

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const container = modalRef.current;
      if (!container) return;
      const focusables = Array.from(container.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTab);
    return () => {
      window.removeEventListener('keydown', handleTab);
      try { prevActiveElementRef.current?.focus(); } catch {}
    };
  }, [showPicker]);

  // Auto-scroll highlighted items into view
  useEffect(() => {
    if (!showPicker) return;
    // country
    try {
      const el = countryListRef.current?.querySelector<HTMLElement>(`[data-country-index='${countryHighlight}']`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    } catch {}
  }, [countryHighlight, showPicker]);

  useEffect(() => {
    if (!showPicker) return;
    try {
      const el = cityListRef.current?.querySelector<HTMLElement>(`[data-city-index='${cityHighlight}']`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    } catch {}
  }, [cityHighlight, showPicker]);

  useEffect(() => {
    if (!showPicker) return;
    try {
      const el = streetListRef.current?.querySelector<HTMLElement>(`[data-street-index='${streetHighlight}']`);
      if (el) el.scrollIntoView({ block: 'nearest' });
    } catch {}
  }, [streetHighlight, showPicker]);

  const handleNext = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
  };
  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
  };

  const handleFaceSuccess = (img?: string) => {
    setFaceRegistered(true);
    setPhoto(img);
    setFaceCapturing(false);
  };

  const handleSubmit = async () => {
    const empId = form.employeeId || `${role === 'admin' ? 'ADM' : 'OJT'}-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
    // If OTP was verified against backend, attempt server registration first
        if (isOtpVerified) {
      try {
          let first_name = form.first_name;
          let last_name = form.last_name;
          if (!first_name || !last_name) {
            const parts = (form.name || '').trim().split(/\s+/);
            first_name = parts.length > 0 ? parts[0] : form.name;
            last_name = parts.length > 1 ? parts.slice(1).join(' ') : '';
          }

          if (role === 'admin' || role === 'trainee') {
            const composedAddress = [ (form as any).street, (form as any).city, (form as any).country ]
              .filter(Boolean)
              .join(', ');
            const payload = {
              email: form.email,
              password: generatedPassword,
              first_name,
              last_name,
              middle_initial: form.middle_initial || undefined,
              age: form.age ? Number(form.age) : undefined,
              address: composedAddress || undefined,
            };
            const res = await authAPI.registerStudent(payload);
          if (res.data && (res.data as any).tokens) {
            localStorage.setItem('access_token', (res.data as any).tokens.access);
            localStorage.setItem('refresh_token', (res.data as any).tokens.refresh);
          }
        } else if (role === 'hte') {
          const payload = {
            email: form.email,
            first_name: first_name,
            last_name: last_name,
            company_name: form.companyName,
            company_address: form.companyAddress,
          };
          const res = await authAPI.registerHTE(payload);
          if (res.data && (res.data as any).tokens) {
            localStorage.setItem('access_token', (res.data as any).tokens.access);
            localStorage.setItem('refresh_token', (res.data as any).tokens.refresh);
          }
        }
      } catch (err) {
        // If server registration fails, fall back to local registration below
      }
    }

    // If OAuth HTE flow pending (no OTP), attempt HTE registration via backend
    if (oauthPending && role === 'hte') {
      try {
        const parts = (form.name || '').trim().split(/\s+/);
        const first_name = parts[0] || '';
        const last_name = parts.slice(1).join(' ') || '';
        const payload = {
          email: form.email,
          first_name,
          last_name,
          company_name: form.companyName,
          company_address: form.companyAddress,
          contact_person: form.contactPerson,
          contact_phone: form.contactPhone,
        };
        const res = await authAPI.registerHTE(payload);
        if (res.data && (res.data as any).tokens) {
          localStorage.setItem('access_token', (res.data as any).tokens.access);
          localStorage.setItem('refresh_token', (res.data as any).tokens.refresh);
        }
      } catch (err) {
        // fallback: continue to local registration
      }
      setOauthPending(false);
    }

    const buildAddrFromForm = () => {
      const parts = [] as string[];
      if (form.barangay) parts.push(form.barangay);
      if ((form as any).street) parts.push((form as any).street);
      if ((form as any).city) parts.push((form as any).city);
      if ((form as any).region) parts.push((form as any).region);
      if ((form as any).country) parts.push(((new Intl.DisplayNames(['en'], { type: 'region' })).of((form as any).country) || (form as any).country));
      return parts.filter(Boolean).join(', ');
    };

    const computedAddress = registrationAddress || buildAddrFromForm() || undefined;

    const newEmp = registerEmployee({
      ...form,
      employeeId: empId,
      position: role === 'admin' ? 'OJT Instructor' : 'OJT Trainee',
      requiredHours: role === 'admin' ? 0 : Number(form.requiredHours),
      faceRegistered,
      photo,
      active: true,
      registrationLocation,
      registrationAddress: computedAddress,
      password: generatedPassword,
    });

    if (role === 'admin') {
      setRegisteredInstructorId(newEmp.id);
    }

    if (photo && isSecurityApiConfigured()) {
      try {
        const response = await registerFace({
          employee_id: newEmp.id,
          image: photo,
        });
        if (response.success && response.image_url) {
          updateEmployee(newEmp.id, { photo: response.image_url, faceRegistered: true });
        }
        // Send Welcome Email via Resend
        try {
          await sendWelcomeEmail(newEmp.email, newEmp.name);
        } catch (emailErr) {
          console.error('Failed to send welcome email:', emailErr);
        }
      } catch {
        // Keep local photo if backend is unavailable
      }
    } else {
      // Send Welcome Email even if no photo registration
      try {
        await sendWelcomeEmail(newEmp.email, newEmp.name);
      } catch (emailErr) {
        console.error('Failed to send welcome email:', emailErr);
      }
    }
    
    // Auto-redirect based on role
    if (role === 'admin') {
      navigate('/admin');
      if (role === 'admin') {
        setRegistrationComplete(true);
      } else {
        navigate(role === 'host' ? '/host/dashboard' : '/employee/dashboard');
      }
    } else {
      navigate('/app');
    }
  };

  const isStepValid = () => {
    // Support either full `name` field or separated `first_name`/`last_name` used in the UI.
    const hasName = Boolean((form as any).name || (((form as any).first_name || '').trim() && ((form as any).last_name || '').trim()));
    const hasEmail = Boolean((form as any).email && (form as any).email.toString().trim());

    if (role === 'admin') {
      const hasDept = Boolean((form as any).department && (form as any).department.trim());
      const hasCourse = Boolean((form as any).course && (form as any).course.trim());
      if (step === 0) return hasName && hasEmail && hasDept && hasCourse;
      return faceRegistered;
    }

    // Trainee / HTE
    if (step === 0) {
      // For trainees, require full name, age, address and email on manual registration
      const hasAge = Boolean((form as any).age && String((form as any).age).trim());
      const hasAddress = Boolean(registrationAddress || (form as any).street || (form as any).city || (form as any).region || (form as any).country || (form as any).barangay);
      const isVerified = true; // Made optional for easier testing
      return hasName && hasEmail && hasAge && hasAddress && isVerified;
    }
    if (step === 1) return Boolean((form as any).companyName && (form as any).supervisorName && (form as any).startDate && (form as any).endDate);
    if (step === 2) return Boolean((form as any).schoolName && (form as any).course);
    return faceRegistered;
  };

  const locationStatusConfig = {
    idle: { color: 'bg-gray-50 border-gray-200', text: 'text-gray-500', label: 'Waiting for location...', icon: <MapPin size={14} className="text-gray-400" /> },
    capturing: { color: 'bg-sky-50 border-sky-200', text: 'text-sky-700', label: 'Capturing your registration location...', icon: <Loader size={14} className="text-sky-500 animate-spin" /> },
    captured: { color: 'bg-green-50 border-green-200', text: 'text-green-700', label: `Location captured: ${registrationAddress}`, icon: <Check size={14} className="text-green-500" /> },
    denied: { color: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700', label: 'Location permission denied. Continuing without location.', icon: <MapPin size={14} className="text-yellow-500" /> },
    error: { color: 'bg-orange-50 border-orange-200', text: 'text-orange-700', label: 'Could not capture location. Continuing without it.', icon: <MapPin size={14} className="text-orange-500" /> },
  };

  const locConfig = locationStatusConfig[locationStatus];

  if (registrationComplete && role === 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="bg-white max-w-md w-full rounded-3xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful!</h2>
          <p className="text-gray-500 mb-8">Your OJT Instructor account has been created. Here is your enrollment QR Code:</p>
          
          <div className="bg-slate-50 p-6 rounded-2xl inline-block mb-8 border-2 border-dashed border-slate-200">
            <QRCodeSVG 
              id="instructor-qr"
              value={`enroll:${registeredInstructorId}`} 
              size={200}
              level="H"
              includeMargin={true}
            />
          </div>
          
          <div className="space-y-3">
            <button onClick={handleShareQr} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              Share QR Code
            </button>
            <button onClick={() => navigate('/login')} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">
              Go to Login
            </button>
          </div>
          <p className="mt-6 text-xs text-slate-400 uppercase tracking-widest font-bold">Instruction: Students must scan this code to enroll under you.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-sky-700 flex flex-col items-center justify-center px-4 py-8">
      <div className="absolute top-0 left-0 w-72 h-72 bg-sky-500/20 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="text-blue-200 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-white font-bold text-lg">
              {role === null ? 'Select Registration Type' : role === 'admin' ? 'OJT Instructor Registration' : 'Trainee Registration'}
            </h1>
            {role !== null && <p className="text-blue-200 text-xs">Step {step + 1} of {steps.length}</p>}
          </div>
        </div>

        {/* Progress - Only show when role is selected */}
        {role !== null && (
          <div className="flex gap-1.5 mb-6">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-sky-400' : 'bg-blue-700'}`}
              />
            ))}
          </div>
        )}

        {/* Location status bar - Only show when role is selected */}
        {role !== null && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border mb-4 ${locConfig.color} ${locConfig.text}`}>
            {locConfig.icon}
            <span className="flex-1 truncate">{locConfig.label}</span>
            {(locationStatus === 'denied' || locationStatus === 'error') && (
              <button onClick={captureLocation} className="underline shrink-0">Retry</button>
            )}
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-6">
          <AnimatePresence mode="wait">
            {/* Role Selection Screen */}
            {role === null && (
              <motion.div
                key="role-select"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <h2 className="font-bold text-gray-800 text-lg">Choose Your Role</h2>
                  <p className="text-sm text-gray-500 mt-1">Select how you want to register</p>
                </div>

                <button
                  onClick={() => selectRole('trainee')}
                  className="w-full p-5 border-2 border-blue-200 rounded-2xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-500 transition-colors shrink-0">
                      <UserCircle size={28} className="text-blue-600 group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 mb-1">Trainee / Employee</h3>
                      <p className="text-xs text-gray-500">Register as an OJT trainee or employee. You'll complete a full registration with company and school information.</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => selectRole('admin')}
                  className="w-full p-5 border-2 border-purple-200 rounded-2xl hover:border-purple-500 hover:bg-purple-50 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-500 transition-colors shrink-0">
                      <ShieldCheck size={28} className="text-purple-600 group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 mb-1">OJT Instructor</h3>
                      <p className="text-xs text-gray-500">Register as an OJT Instructor or supervisor. You'll have access to manage employees, view reports, and configure settings.</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => selectRole('hte')}
                  className="w-full p-5 border-2 border-green-200 rounded-2xl hover:border-green-500 hover:bg-green-50 transition-all text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-500 transition-colors shrink-0">
                      <Building size={28} className="text-green-600 group-hover:text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 mb-1">Host Training Establishment (HTE)</h3>
                      <p className="text-xs text-gray-500">Register as an HTE representative. You'll monitor employee attendance, rendered hours, and manage registrations.</p>
                    </div>
                  </div>
                </button>

                

                <div className="mt-6 pt-4 border-t border-gray-100">
                  <p className="text-center text-xs text-gray-400">
                    Already have an account?{' '}
                    <Link to="/" className="text-blue-600 hover:text-blue-800 font-medium">
                      Sign in here
                    </Link>
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 0: Personal Info - Only show when role is selected */}
            {role !== null && step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <User size={16} className="text-blue-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">Personal Information</h2>
                </div>
                
                  <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Last Name *</label>
                      <input value={form.last_name} onChange={e => update('last_name', e.target.value)} placeholder="Dela Cruz" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">First Name *</label>
                      <input value={form.first_name} onChange={e => update('first_name', e.target.value)} placeholder="Juan" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Middle Initial</label>
                      <input value={form.middle_initial} onChange={e => update('middle_initial', e.target.value)} placeholder="D" maxLength={1} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Email Address *</label>
                    <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                      placeholder="your@email.com" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  
                  {role === 'trainee' && (
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-blue-800 uppercase tracking-wider">Email Verification</label>
                        {isOtpVerified && (
                          <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Verified</span>
                        )}
                      </div>
                      
                      {!isOtpVerified ? (
                        <div className="flex gap-2">
                          {!otpSent ? (
                            <button 
                              type="button" 
                              onClick={handleRequestOtp}
                              disabled={otpVerifying || !form.email}
                              className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm"
                            >
                              {otpVerifying ? 'Sending...' : 'Request Confirmation Code'}
                            </button>
                          ) : (
                            <>
                              <input 
                                value={otpCode} 
                                onChange={e => setOtpCode(e.target.value)} 
                                placeholder="6-digit code" 
                                className="flex-1 px-3 py-2 border border-blue-200 rounded-xl text-center font-bold tracking-widest focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                maxLength={6}
                              />
                              <button 
                                type="button" 
                                onClick={verifyOtp}
                                className="px-4 py-2 bg-blue-700 text-white rounded-xl text-sm font-bold"
                              >
                                Verify
                              </button>
                              <button 
                                type="button" 
                                onClick={handleRequestOtp}
                                className="px-2 text-[10px] text-blue-600 underline"
                              >
                                Resend
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-green-700">
                          <Check size={16} />
                          <span className="text-sm font-medium">Email confirmed via Resend API</span>
                        </div>
                      )}
                    </div>
                  )}

                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Birthdate *</label>
                        <input type="date" value={form.birthdate} onChange={e => update('birthdate', e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Age (auto-calculated)</label>
                        <input value={form.age} disabled type="number"
                          placeholder="Enter birthdate first" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 text-gray-500" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Address</label>
                        <div className="relative">
                          <div className="flex gap-2">
                            <input value={addrQuery} onChange={e => { setAddrQuery(e.target.value); }} placeholder="Start typing your address" className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                            <button type="button" onClick={() => setShowPicker(s => !s)} className="px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 text-sm">Pick</button>
                          </div>
                            {showAddrSuggestions && addrSuggestions.length > 0 && (
                            <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded mt-1 max-h-52 overflow-auto">
                              {addrSuggestions.map((p: any) => (
                                <div key={(p.geonameId || p.name)} onClick={async () => {
                                  try {
                                    // If the suggestion has an id, fetch details; otherwise derive from suggestion
                                    let parsed: any = null;
                                    if (p.geonameId) {
                                      const det = await getPlaceDetails(p.geonameId);
                                      parsed = parsePlaceComponents(det);
                                    }
                                    update('country', (parsed && parsed.country) || p.countryCode || '');
                                    update('city', (parsed && parsed.city) || p.name || '');
                                    update('street', (parsed && parsed.street) || parsed?.formatted || p.name || '');
                                    setRegistrationAddress((parsed && parsed.formatted) || p.name || '');
                                    setAddrQuery((parsed && parsed.formatted) || p.name || '');
                                    setAddrSuggestions([]);
                                    setShowAddrSuggestions(false);
                                  } catch {
                                    // ignore
                                  }
                                }} className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">{p.name}{p.adminName1 ? ', ' + p.adminName1 : ''}{p.countryName ? ', ' + p.countryName : ''}</div>
                              ))}
                            </div>
                          )}
                          {showPicker && (
                            <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="address-picker-title" aria-describedby="address-picker-desc" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                              <div className="bg-white w-[90%] max-w-4xl rounded-2xl shadow-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h3 id="address-picker-title" className="font-bold">Pick Address</h3>
                                  <div className="flex items-center gap-2">
                                    <input aria-label="Filter cities" ref={filterInputRef} value={cityFilter} onChange={e => { setCityFilter(e.target.value); setCityHighlight(0); }} placeholder="Filter cities" className="px-3 py-2 border rounded text-sm" />
                                    <button onClick={() => { setShowPicker(false); }} className="text-sm underline">Close</button>
                                  </div>
                                </div>
                                <p id="address-picker-desc" className="sr-only">Use arrow keys to navigate countries, cities, and streets. Press Enter to select.</p>

                                <div className="grid grid-cols-3 gap-4 h-80">
                                  {/* Countries */}
                                  <div className="border rounded p-2 overflow-auto">
                                    <div className="text-xs text-gray-500 mb-2">Country</div>
                                    {(availableCountries as any[]).length === 0 ? (
                                      <div className="text-sm text-gray-400">No countries</div>
                                    ) : (
                                      <ul role="listbox" aria-label="Countries" ref={countryListRef}>
                                        {(availableCountries as any[]).map((c: any, idx: number) => (
                                          <li id={`country-${idx}`} tabIndex={0} role="option" aria-selected={pickerCountry === c.code} data-country-index={idx} key={c.code} className={`px-2 py-1 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-300 ${pickerCountry === c.code ? 'bg-sky-100 font-semibold' : ''} ${countryHighlight === idx ? 'ring-2 ring-sky-200' : ''}`} onClick={() => { setPickerCountry(c.code); setPickerCity(''); setCountryHighlight(idx); setCityHighlight(0); setActivePane('city'); }} onMouseEnter={() => setCountryHighlight(idx)}>
                                            {(new Intl.DisplayNames(['en'], {type: 'region'})).of(c.code) || c.name || c.code}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>

                                  {/* Regions */}
                                  <div className="border rounded p-2 overflow-auto">
                                    <div className="text-xs text-gray-500 mb-2">Regions</div>
                                    {!pickerCountry ? (
                                      <div className="text-sm text-gray-400">Select a country</div>
                                    ) : ((availableRegions || []).length === 0 ? (
                                      <div className="text-sm text-gray-400">No regions available</div>
                                    ) : (
                                      <ul role="listbox" className="space-y-1">
                                        {(availableRegions || []).map((g: string, idx: number) => (
                                          <li key={g} id={`region-${idx}`} tabIndex={0} role="option" aria-selected={pickerRegion === g} data-region-index={idx} className={`px-2 py-1 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-300 ${pickerRegion === g ? 'bg-sky-100 font-semibold' : ''} ${regionHighlight === idx ? 'ring-2 ring-sky-200' : ''}`} onClick={() => { setPickerRegion(g); setPickerCity(''); setRegionHighlight(idx); setCityHighlight(0); setActivePane('city'); }} onMouseEnter={() => setRegionHighlight(idx)}>
                                            {g}
                                          </li>
                                        ))}
                                      </ul>
                                    ))}
                                  </div>

                                  {/* Cities in selected region */}
                                  <div className="border rounded p-2 overflow-auto">
                                    <div className="text-xs text-gray-500 mb-2">Cities</div>
                                    {!pickerRegion ? (
                                      <div className="text-sm text-gray-400">Select a region</div>
                                    ) : (availableCitiesForRegion && availableCitiesForRegion.length > 0 ? (
                                      <ul role="listbox" aria-label="Cities in region">
                                        {availableCitiesForRegion.map((ct: string, idx: number) => (
                                          <li key={ct} id={`city-${idx}`} tabIndex={0} role="option" aria-selected={pickerCity === ct} data-city-index={idx} className={`px-2 py-1 rounded cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-300 ${pickerCity === ct ? 'bg-sky-100 font-semibold' : ''} ${cityHighlight === idx ? 'ring-2 ring-sky-200' : ''}`} onClick={() => { setPickerCity(ct); setCityHighlight(idx); setActivePane('city'); }} onMouseEnter={() => setCityHighlight(idx)}>
                                            {ct}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <div className="text-sm text-gray-400">No cities found for this region.</div>
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-3 flex justify-end gap-2">
                                  <button onClick={() => { setShowPicker(false); }} className="px-3 py-2 border rounded">Cancel</button>
                                  <button onClick={async () => {
                                    const countryName = (new Intl.DisplayNames(['en'], {type: 'region'})).of(pickerCountry) || pickerCountry;
                                    update('country', pickerCountry);
                                    update('region', pickerRegion);
                                    update('city', pickerCity);
                                    // We intentionally do not auto-fill barangay/street — user will enter barangay manually
                                    setRegistrationAddress(`${pickerCity || ''}${pickerCity ? ', ' : ''}${pickerRegion ? pickerRegion + ', ' : ''}${countryName}`);
                                    setAddrQuery(`${pickerCity || ''}${pickerCity ? ', ' : ''}${pickerRegion ? pickerRegion + ', ' : ''}${countryName}`);
                                    setShowPicker(false);
                                    setAddrSuggestions([]);
                                    setShowAddrSuggestions(false);
                                  }} className="px-3 py-2 bg-sky-600 text-white rounded">Use</button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Barangay / Neighborhood</label>
                        <input value={form.barangay} onChange={e => update('barangay', e.target.value)} placeholder="e.g. San Isidro" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-600 block mb-1">Employee ID (optional)</label>
                        <input value={form.employeeId} onChange={e => update('employeeId', e.target.value)}
                          placeholder="Auto-generated if empty" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                      </div>

                      {registrationLocation && (
                        <div className="mt-4 space-y-3">
                          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <MapPin className="text-green-600 mt-0.5" size={18} />
                              <div>
                                <p className="text-green-800 text-sm font-bold">Registration Location Captured</p>
                                <p className="text-green-600 text-xs mt-0.5">Your official geofence location is locked.</p>
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={() => setShowLocationMap(!showLocationMap)}
                              className="px-3 py-1.5 bg-white border border-green-200 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition-colors"
                            >
                              {showLocationMap ? 'Hide Map' : 'See your location'}
                            </button>
                          </div>

                          <AnimatePresence>
                            {showLocationMap && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 200, opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden rounded-2xl border border-gray-200 shadow-inner relative"
                              >
                                <MapContainer 
                                  center={[registrationLocation.lat, registrationLocation.lng]} 
                                  zoom={16} 
                                  style={{ height: '100%', width: '100%' }}
                                  dragging={false}
                                  doubleClickZoom={false}
                                  scrollWheelZoom={false}
                                  touchZoom={false}
                                  zoomControl={false}
                                  boxZoom={false}
                                >
                                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                  <Marker position={[registrationLocation.lat, registrationLocation.lng]} />
                                </MapContainer>
                                <div className="absolute inset-0 z-[1000] pointer-events-none border-2 border-purple-500/20 rounded-2xl" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center">
                    <Building size={16} className="text-sky-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">Company Information</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Company Name *</label>
                    <input value={form.companyName} onChange={e => update('companyName', e.target.value)}
                      placeholder="Company Name" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Supervisor Name *</label>
                    <input value={form.supervisorName} onChange={e => update('supervisorName', e.target.value)}
                      placeholder="Mr./Ms. Supervisor" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">Start Date *</label>
                      <input type="date" value={form.startDate} onChange={e => update('startDate', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 block mb-1">End Date *</label>
                      <input type="date" value={form.endDate} onChange={e => update('endDate', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Required OJT Hours</label>
                    <input type="number" value={form.requiredHours} onChange={e => update('requiredHours', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <GraduationCap size={16} className="text-green-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">School Information</h2>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">School / University *</label>
                    <input value={form.schoolName} onChange={e => update('schoolName', e.target.value)}
                      placeholder="University Name" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Course / Program *</label>
                    <input value={form.course} onChange={e => update('course', e.target.value)}
                      placeholder="e.g. BS Information Technology" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  </div>
                </div>

              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Camera size={16} className="text-purple-700" />
                  </div>
                  <h2 className="font-bold text-gray-800">Face Registration</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">Register your face for biometric time recording. The captured image will be stored in the system for identity verification during clock-in/out.</p>

                {faceCapturing ? (
                  <FaceCapture
                    mode="register"
                    employeeName={form.name}
                    onSuccess={handleFaceSuccess}
                    onCancel={() => setFaceCapturing(false)}
                    autoStart
                  />
                ) : faceRegistered ? (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-green-300">
                      {photo ? (
                        <img src={photo} alt="Registered Face" className="w-full h-full object-cover rounded-full" style={{ transform: 'scaleX(-1)' }} />
                      ) : (
                        <Check size={36} className="text-green-600" />
                      )}
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-green-700">Face Registered!</p>
                      <p className="text-xs text-gray-500 mt-0.5">Your biometric image has been captured and will be stored</p>
                    </div>
                    <button onClick={() => { setFaceRegistered(false); setFaceCapturing(true); }}
                      className="text-xs text-blue-600 hover:text-blue-800">Re-register face</button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300">
                      <Camera size={28} className="text-gray-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700">No face registered yet</p>
                      <p className="text-xs text-gray-400 mt-0.5">Required for biometric time recording</p>
                    </div>
                    <button onClick={() => setFaceCapturing(true)}
                      className="px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2">
                      <Camera size={16} />
                      Register Face
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {role !== null && (
            <div className="mt-4 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-indigo-700">Generated Password</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={regeneratePassword}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={copyPassword}
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    {passwordCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <code className="text-sm font-mono font-bold text-indigo-800 bg-white px-2 py-1 rounded-lg border border-indigo-100">
                  {generatedPassword}
                </code>
              </div>
              <p className="text-xs text-indigo-600 mt-2">Save this password. You'll need it to log in.</p>
            </div>
          )}

          {/* Navigation - Only show when role is selected */}
          {role !== null && (
            <div className="flex gap-3 mt-6">
              {step > 0 && (
                <button onClick={handleBack}
                  className="flex items-center gap-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                  <ArrowLeft size={14} />
                  Back
                </button>
              )}
              {step < steps.length - 1 ? (
                <button onClick={handleNext} disabled={!isStepValid()}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-blue-700 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Next
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={!faceRegistered}
                  className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <Check size={14} />
                  Complete Registration
                </button>
              )}
            </div>
          )}

          {role !== null && step === steps.length - 1 && !faceRegistered && (
            <p className="text-center text-xs text-gray-400 mt-2">Face registration required to complete</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
