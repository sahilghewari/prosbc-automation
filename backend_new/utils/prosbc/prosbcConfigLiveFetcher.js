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
    console.error(`[Config Fetcher] Network error fetching ${url}:`, fetchError.message);
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
    console.error(`[Config Fetcher] Error reading response text:`, textError.message);
    throw new Error(`Error reading response: ${textError.message}`);
  }
  
  console.log(`[Config Fetcher] ========== HTML PARSING DEBUG ==========`);
  console.log(`[Config Fetcher] Full HTML length: ${html.length} characters`);
  
  // Check if we got redirected to login page
  if (html.includes('login') && html.includes('Username')) {
    console.error(`[Config Fetcher] Redirected to login page - session expired`);
    throw new Error('Session expired - redirected to login page');
  }
  
  // Parse the config dropdown
  const selectMatch = html.match(/<select[^>]*id=["']configuration_select["'][^>]*>([\s\S]*?)<\/select>/i);
  if (!selectMatch) {
    console.log(`[Config Fetcher] ERROR: Could not find configuration dropdown in HTML`);
    console.log(`[Config Fetcher] HTML snippet (first 2000 chars):`, html.substring(0, 2000));
    
    // Check if the page structure is different - maybe it's the new UI
    const alternativeSelect = html.match(/<select[^>]*name=["']configuration[^"']*["'][^>]*>([\s\S]*?)<\/select>/i);
    if (alternativeSelect) {
      console.log(`[Config Fetcher] Found alternative configuration dropdown`);
      // TODO: Parse alternative format if needed
    }
    
    throw new Error('Could not find configuration dropdown');
  }
  
  const selectHtml = selectMatch[1];
  const fullSelectTag = selectMatch[0];
  
  console.log(`[Config Fetcher] Found select dropdown!`);
  console.log(`[Config Fetcher] Full select tag:`, fullSelectTag);
  console.log(`[Config Fetcher] Select HTML content:`, selectHtml);
  console.log(`[Config Fetcher] Select HTML length: ${selectHtml.length} characters`);
  
  // Check for selected attribute in the select element to get the default selected config
  const selectTag = html.match(/<select[^>]*id=["']configuration_select["'][^>]*>/i);
  let defaultSelectedId = null;
  if (selectTag) {
    const selectTagStr = selectTag[0];
    console.log(`[Config Fetcher] Select opening tag: ${selectTagStr}`);
  }
  
  // Find all options with detailed logging
  const optionRegex = /<option value="(\d+)"(\s+selected)?[^>]*>\*?([^<]+)<\/option>/g;
  const configs = [];
  let match;
  let optionCount = 0;
  
  console.log(`[Config Fetcher] Starting option parsing...`);
  
  while ((match = optionRegex.exec(selectHtml)) !== null) {
    optionCount++;
    const id = match[1];
    const isSelected = !!match[2]; // Check if option has 'selected' attribute
    let name = match[3].trim();
    
    console.log(`[Config Fetcher] ===== OPTION ${optionCount} =====`);
    console.log(`[Config Fetcher] Full match: "${match[0]}"`);
    console.log(`[Config Fetcher] ID: ${id}`);
    console.log(`[Config Fetcher] Selected attribute: "${match[2] || 'none'}"`);
    console.log(`[Config Fetcher] Raw name: "${name}"`);
    console.log(`[Config Fetcher] Is selected: ${isSelected}`);
    
    // Remove the * prefix if present (it's just a marker)
    if (name.startsWith('*')) {
      name = name.substring(1);
    }
    
    // Decode HTML entities from the config name
    name = name
      .replace(/&nbsp;/g, ' ')   // Replace HTML non-breaking spaces with regular spaces
      .replace(/&amp;/g, '&')   // Decode HTML ampersands
      .replace(/&lt;/g, '<')    // Decode HTML less-than
      .replace(/&gt;/g, '>')    // Decode HTML greater-than
      .replace(/&quot;/g, '"')  // Decode HTML quotes
      .trim();                  // Remove any extra whitespace
    
    console.log(`[Config Fetcher] Cleaned name: "${name}"`);
    
    // Check if this option is in the 'Active' optgroup
    const before = selectHtml.substring(0, match.index);
    console.log(`[Config Fetcher] Before text (last 100 chars): "${before.slice(-100)}"`);
    
    // More robust detection: if we're in the Active optgroup, this is the selected config
    const isInActiveGroup = /<optgroup label=['"]Active['"]>/i.test(before) && 
                           !/<\/optgroup>/i.test(before.split(/<optgroup label=['"]Active['"]>/i).pop() || '');
    
    // The config in the "Active" optgroup is the currently selected one
    const configIsSelected = isInActiveGroup;
    
    // All configs are "active" (available), but the one in Active group is currently selected
    const active = true;
    
    console.log(`[Config Fetcher] Is in Active group: ${isInActiveGroup}`);
    console.log(`[Config Fetcher] Config is selected: ${configIsSelected}`);
    console.log(`[Config Fetcher] Is active: ${active}`);
    
    configs.push({ id, name, active, isSelected: configIsSelected });
    console.log(`[Config Fetcher] ========================`);
  }
  
  console.log(`[Config Fetcher] Parsing complete. Found ${optionCount} options total.`);
  console.log(`[Config Fetcher] Final configs:`, configs.map(c => ({ 
    id: c.id, 
    name: c.name, 
    active: c.active, 
    isSelected: c.isSelected 
  })));
  console.log(`[Config Fetcher] ========== END HTML PARSING DEBUG ==========`);
  
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
