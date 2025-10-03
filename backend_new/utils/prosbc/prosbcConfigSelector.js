// Utility for selecting ProSBC configuration before file operations
// Usage: import and call selectConfiguration(configId) before file operations
import fetch from 'node-fetch';

const DEFAULT_CONFIG_ID = process.env.PROSBC_CONFIG_ID || '3'; // '3' is usually the active config

/**
 * Selects the ProSBC configuration by configId (string or number)
 * @param {string|number} configId - The configuration ID to select (e.g., '1', '2', '3')
 * @param {string} baseURL - The ProSBC base URL
 * @param {string} sessionCookie - The session cookie value (string)
 * @returns {Promise<boolean>} true if selection succeeded
 */
export async function selectConfiguration(configId = DEFAULT_CONFIG_ID, baseURL, sessionCookie) {
  if (!configId || !baseURL || !sessionCookie) throw new Error('Missing configId, baseURL, or sessionCookie');
  const url = `${baseURL}/configurations/${configId}/choose_redirect`;
  const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Node.js)',
    'Cache-Control': 'no-cache',
    'Cookie': `_WebOAMP_session=${sessionCookie}`
  };
  // Use redirect: 'manual' to prevent following redirects automatically
  // This avoids potential redirect loops
  const res = await fetch(url, { method: 'GET', headers, redirect: 'manual', follow: 0 });
  // 302 is expected, 200 is also OK
  if (res.status === 302 || res.status === 200) {
    return true;
  }
  throw new Error(`Failed to select configuration: ${res.status}`);
}

/**
 * Returns the default config id (active config)
 */
export function getDefaultConfigId() {
  return DEFAULT_CONFIG_ID;
}

/**
 * Returns all known config ids (for manual selection)
 */
export function getAllConfigIds() {
  // You can update this list if configs change
  return ['3', '1', '2'];
}
