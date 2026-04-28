import configJson from './config.json';

// Simple runtime config loader. Edit src/config.json to change backend URL during development.
const cfg = (configJson as { BACKEND?: string; API_KEY?: string }) || {};
export const BACKEND = cfg.BACKEND || 'http://localhost:8000';
export const API_KEY = cfg.API_KEY || '';

export default { BACKEND, API_KEY };
