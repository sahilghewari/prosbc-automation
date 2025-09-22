// Fetches live configuration IDs from ProSBC web interface
// Usage: import and call fetchLiveConfigIds(baseURL, sessionCookie)
import fetch from 'node-fetch';

/**
 * Fetches the available configuration IDs from the ProSBC main page (parses the config dropdown)
 * @param {string} baseURL - The ProSBC base URL
 * @param {string} sessionCookie - The session cookie value (string)
 * @returns {Promise<Array<{id: string, name: string, active: boolean, isSelected: boolean}>>} Array of config objects
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

  console.log(`[Config Fetcher] Fetching ProSBC main page from: ${url}`);

  let res;
  try {
    res = await fetch(url, { method: 'GET', headers, timeout: 10000 });
  } catch (fetchError) {
    console.error(`[Config Fetcher] Network error: ${fetchError.message}`);
    throw new Error(`Network error: ${fetchError.message}`);
  }

  if (!res.ok) {
    console.error(`[Config Fetcher] HTTP error: ${res.status} ${res.statusText}`);
    throw new Error(`Failed to fetch main page: ${res.status} ${res.statusText}`);
  }

  let html;
  try {
    html = await res.text();
  } catch (textError) {
    console.error(`[Config Fetcher] Error reading response: ${textError.message}`);
    throw new Error(`Error reading response: ${textError.message}`);
  }

  // Check if we got redirected to login page
  if (html.includes('login') && html.includes('Username')) {
    console.error(`[Config Fetcher] Session expired - redirected to login page`);
    throw new Error('Session expired - redirected to login page');
  }

  // Parse the config dropdown
  const selectMatch = html.match(/<select[^>]*id=["']configuration_select["'][^>]*>([\s\S]*?)<\/select>/i);
  if (!selectMatch) {
    console.error(`[Config Fetcher] Could not find configuration dropdown`);
    throw new Error('Could not find configuration dropdown');
  }

  const selectHtml = selectMatch[1];

  // Find all options
  const optionRegex = /<option value="(\d+)"(\s+selected)?[^>]*>\*?([^<]+)<\/option>/g;
  const configs = [];
  let match;

  while ((match = optionRegex.exec(selectHtml)) !== null) {
    const id = match[1];
    const isSelected = !!match[2];
    let name = match[3].trim();

    // Remove the * prefix if present
    if (name.startsWith('*')) {
      name = name.substring(1);
    }

    // Decode HTML entities
    name = name
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    // Check if this option is in the 'Active' optgroup
    const before = selectHtml.substring(0, match.index);
    const isInActiveGroup = /<optgroup label=['"]Active['"]>/i.test(before) &&
                           !/<\/optgroup>/i.test(before.split(/<optgroup label=['"]Active['"]>/i).pop() || '');

    const configIsSelected = isInActiveGroup;
    const active = true;

    configs.push({ id, name, active, isSelected: configIsSelected });
  }

  console.log(`[Config Fetcher] Found ${configs.length} configurations`);

  // If no configs were found, try to provide a fallback
  if (configs.length === 0) {
    console.warn(`[Config Fetcher] No configs found via parsing. Providing fallback...`);

    // Try to extract any configuration ID from the HTML
    const anyConfigMatch = html.match(/configuration[^>]*=["']?(\d+)["']?/i);
    if (anyConfigMatch) {
      const fallbackId = anyConfigMatch[1];
      console.log(`[Config Fetcher] Found fallback config ID: ${fallbackId}`);
      configs.push({
        id: fallbackId,
        name: `config_${fallbackId}`,
        active: true,
        isSelected: true
      });
    } else {
      // Ultimate fallback - return a default config
      console.warn(`[Config Fetcher] Using ultimate fallback config`);
      configs.push({
        id: '1',
        name: 'config_default',
        active: true,
        isSelected: true
      });
    }
  }

  return configs;
}
