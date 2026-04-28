import configJson from './config.json';
import Constants from 'expo-constants';

// Prefer expo runtime config (app.config.js) when available, fallback to local config.json.
const extra = (Constants.expoConfig && Constants.expoConfig.extra) || (Constants.manifest && (Constants.manifest as any).extra) || {};
const fileCfg = (configJson as { BACKEND?: string; API_KEY?: string }) || {};

export const BACKEND = (extra.BACKEND as string) || fileCfg.BACKEND || 'http://localhost:8000';
export const API_KEY = (extra.API_KEY as string) || fileCfg.API_KEY || '';

export default { BACKEND, API_KEY };
