import configJson from './config.json';

// Simple runtime config loader. Edit src/config.json to change backend URL during development.
const cfg = (configJson as { BACKEND?: string }) || {};
export const BACKEND = cfg.BACKEND || 'http://localhost:8000';

export default { BACKEND };
