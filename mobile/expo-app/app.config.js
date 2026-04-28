module.exports = ({ config }) => {
  // At runtime, set BACKEND and API_KEY environment variables before running `expo start`.
  // Example (UNIX): BACKEND=http://192.168.1.42:8000 API_KEY=supersecret expo start
  // Example (Windows PowerShell): $env:BACKEND='http://192.168.1.42:8000'; $env:API_KEY='supersecret'; expo start
  return {
    ...config,
    extra: {
      BACKEND: process.env.BACKEND || 'http://localhost:8000',
      API_KEY: process.env.API_KEY || '',
    },
  };
};
