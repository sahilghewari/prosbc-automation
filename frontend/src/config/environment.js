/**
 * Environment Detection and Configuration
 * Browser-compatible environment detection
 */

// Detect environment in browser
const isUbuntuDeployment = () => {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  return hostname !== 'localhost' && hostname !== '127.0.0.1';
};

const isBrowser = () => typeof window !== 'undefined';

const isProduction = () => {
  return import.meta.env?.PROD || isUbuntuDeployment();
};

// Configuration object
export const config = {
  environment: {
    isUbuntu: isUbuntuDeployment(),
    isBrowser: isBrowser(),
    isProduction: isProduction(),
    isDevelopment: !isProduction()
  },
  
  storage: {
    type: isProduction() ? 'filesystem' : 'localstorage',
    baseDir: '/root/prosbc-dashboard/files',
    directories: {
      df: '/root/prosbc-dashboard/files/df',
      dm: '/root/prosbc-dashboard/files/dm',
      routesets: '/root/prosbc-dashboard/files/routesets',
      backups: '/root/prosbc-dashboard/files/backups',
      naps: '/root/prosbc-dashboard/files/naps',
      logs: '/root/prosbc-dashboard/files/logs',
      metadata: '/root/prosbc-dashboard/files/metadata'
    }
  },
  
  app: {
    name: 'ProSBC NAP Testing Dashboard',
    version: '1.0.0',
    port: 3000,
    host: '0.0.0.0'
  },
  
  api: {
    backendUrl: isProduction() 
      ? '/backend'
      : '/backend',
    timeout: 30000
  }
};

// Helper functions
export const getStorageType = () => config.storage.type;
export const isFileSystemStorage = () => config.storage.type === 'filesystem';
export const isLocalStorageMode = () => config.storage.type === 'localstorage';

// Environment info for debugging
export const getEnvironmentInfo = () => ({
  environment: import.meta.env?.MODE || 'development',
  platform: typeof window !== 'undefined' ? 'browser' : 'node',
  storage: config.storage.type,
  timestamp: new Date().toISOString()
});

export default config;
