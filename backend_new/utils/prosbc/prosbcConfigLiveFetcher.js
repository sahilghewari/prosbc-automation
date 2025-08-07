// Fetches live configuration IDs from ProSBC web interface
// Usage: import and call fetchLiveConfigIds(baseURL, sessionCookie)
import fetch from 'node-fetch';

/**
 * Fetches the available configuration IDs from the ProSBC main page (parses the config dropdown)
 * @param {string} baseURL - The ProSBC base URL
 * @param {string} sessionCookie - The session cookie value (string)
 * @returns {Promise<Array<{id: string, name: string, active: boolean}>>} Array of config objects
 */
export async function fetchLiveConfigIds(baseURL, sessionCookie) {
  if (!baseURL || !sessionCookie) throw new Error('Missing baseURL or sessionCookie');
  const url = `${baseURL}/`;
  const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Node.js)',
    'Cache-Control': 'no-cache',
    'Cookie': `_WebOAMP_session=${sessionCookie}`
  };
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) throw new Error(`Failed to fetch main page: ${res.status}`);
  const html = await res.text();
  // Parse the config dropdown
  const selectMatch = html.match(/<select[^>]*id=["']configuration_select["'][^>]*>([\s\S]*?)<\/select>/i);
  if (!selectMatch) throw new Error('Could not find configuration dropdown');
  const selectHtml = selectMatch[1];
  // Find all options
  const optionRegex = /<option value="(\d+)">\*?([^<]+)<\/option>/g;
  const configs = [];
  let match;
  while ((match = optionRegex.exec(selectHtml)) !== null) {
    const id = match[1];
    let name = match[2].trim();
    
    console.log(`[Config Fetcher] Raw config name for ID ${id}: "${name}"`);
    
    // Decode HTML entities from the config name
    name = name
      .replace(/&nbsp;/g, ' ')   // Replace HTML non-breaking spaces with regular spaces
      .replace(/&amp;/g, '&')   // Decode HTML ampersands
      .replace(/&lt;/g, '<')    // Decode HTML less-than
      .replace(/&gt;/g, '>')    // Decode HTML greater-than
      .replace(/&quot;/g, '"')  // Decode HTML quotes
      .trim();                  // Remove any extra whitespace
    
    console.log(`[Config Fetcher] Cleaned config name for ID ${id}: "${name}"`);
    
    // Check if this option is in the 'Active' optgroup
    const before = selectHtml.substring(0, match.index);
    const active = /<optgroup label=['"]Active['"]>/i.test(before) && !/<optgroup/i.test(before.split(/<option/).pop());
    configs.push({ id, name, active });
  }
  return configs;
}
