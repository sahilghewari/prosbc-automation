import axios from 'axios';
import { JSDOM } from 'jsdom';
import { URLSearchParams } from 'url';
import { prosbcLogin } from './login.js';
import { getInstanceContext } from './multiInstanceManager.js';

// Store multiple API clients for different instances
const sessionCookies = new Map();
const lastLoginTimes = new Map();
const SESSION_TTL_MS = 20 * 60 * 1000; // 20 minutes

// Add login locks to prevent multiple simultaneous logins
const loginLocks = new Map();

// Helper function to validate if existing session is still active
async function validateSession(baseURL, sessionCookie) {
  try {
    const response = await axios.get(`${baseURL}/`, {
      headers: {
        'Cookie': `_WebOAMP_session=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)'
      },
      timeout: 5000,
      validateStatus: (status) => status < 500 // Accept redirects and client errors
    });
    
    // If we get a successful response or redirect (not auth error), session is valid
    return response.status !== 401 && response.status !== 403;
  } catch (error) {
    // If request fails, assume session is invalid
    return false;
  }
}

// Clear session cache for a specific instance or all instances
const clearSessionCache = (instanceId = null) => {
  if (instanceId) {
    const sessionKey = instanceId || 'default';
    sessionCookies.delete(sessionKey);
    lastLoginTimes.delete(sessionKey);
    loginLocks.delete(sessionKey);
    console.log(`[RoutesetMapping] Cleared session cache for instance: ${sessionKey}`);
  } else {
    sessionCookies.clear();
    lastLoginTimes.clear();
    loginLocks.clear();
    console.log('[RoutesetMapping] Cleared all session caches');
  }
};

async function getApiClient(instanceId = null) {
  let baseURL, username, password;
  
  if (instanceId) {
    // Get instance-specific configuration
    const instanceContext = await getInstanceContext(instanceId);
    baseURL = instanceContext.baseUrl;
    username = instanceContext.username;
    password = instanceContext.password;
    console.log(`[RoutesetMapping] Using instance: ${instanceContext.name} (${baseURL})`);
  } else {
    // Fallback to environment variables
    baseURL = process.env.PROSBC_BASE_URL;
    username = process.env.PROSBC_USERNAME;
    password = process.env.PROSBC_PASSWORD;
    console.log(`[RoutesetMapping] Using environment variables: ${baseURL}`);
  }
  
  if (!baseURL || !username || !password) {
    throw new Error('ProSBC credentials not found. Please set credentials in environment variables or provide valid instanceId');
  }
  
  const sessionKey = instanceId || 'default';
  let sessionCookie = sessionCookies.get(sessionKey);
  let lastLoginTime = lastLoginTimes.get(sessionKey) || 0;
  
  // Check if login is already in progress for this instance
  if (loginLocks.get(sessionKey)) {
    console.log(`[RoutesetMapping] Login already in progress for ${sessionKey}, waiting...`);
    // Wait for existing login to complete
    while (loginLocks.get(sessionKey)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    // Re-check session after waiting
    sessionCookie = sessionCookies.get(sessionKey);
    lastLoginTime = lastLoginTimes.get(sessionKey) || 0;
  }
  
  // Refresh session if expired or not set
  if (!sessionCookie || (Date.now() - lastLoginTime > SESSION_TTL_MS)) {
    // If we have a session cookie but it's within TTL, validate it first
    if (sessionCookie && (Date.now() - lastLoginTime <= SESSION_TTL_MS)) {
      console.log(`[RoutesetMapping] Validating existing session for ${sessionKey}...`);
      const isValid = await validateSession(baseURL, sessionCookie);
      if (isValid) {
        console.log(`[RoutesetMapping] Session still valid for ${sessionKey}, reusing...`);
        // Update last login time to extend TTL
        lastLoginTimes.set(sessionKey, Date.now());
      } else {
        console.log(`[RoutesetMapping] Session expired for ${sessionKey}, will login...`);
        sessionCookie = null; // Force login
      }
    }
    
    // Proceed with login if session is invalid or expired
    if (!sessionCookie) {
      // Acquire login lock
      if (loginLocks.get(sessionKey)) {
        console.log(`[RoutesetMapping] Another login is already in progress for ${sessionKey}, waiting...`);
        // Wait for existing login to complete
        while (loginLocks.get(sessionKey)) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        // Re-check session after waiting
        sessionCookie = sessionCookies.get(sessionKey);
        lastLoginTime = lastLoginTimes.get(sessionKey) || 0;
      }
      
      // Double-check after acquiring lock
      if (!sessionCookie || (Date.now() - lastLoginTime > SESSION_TTL_MS)) {
        loginLocks.set(sessionKey, true);
        try {
          console.log(`[RoutesetMapping] Logging in to ProSBC instance: ${sessionKey}...`);
          sessionCookie = await prosbcLogin(baseURL, username, password);
          sessionCookies.set(sessionKey, sessionCookie);
          lastLoginTimes.set(sessionKey, Date.now());
          console.log(`[RoutesetMapping] Obtained ProSBC session cookie for: ${sessionKey}`);
        } finally {
          // Release login lock
          loginLocks.delete(sessionKey);
        }
      } else {
        console.log(`[RoutesetMapping] Session refreshed by another request for ${sessionKey}`);
      }
    }
  }
  
  const apiClient = axios.create({
    baseURL,
    timeout: 60000,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html, application/json, */*',
      'Cookie': `_WebOAMP_session=${sessionCookie}`,
      'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)'
    },
    withCredentials: true
  });
  return apiClient;
}

// Helper function to parse HTML table data
const parseRoutesetMappings = (html) => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  const mappings = [];
  const rows = doc.querySelectorAll('#tbgw_files_db table.list tr');
  
  // Skip header row
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td');
    
    if (cells.length >= 3) {
      const napLink = cells[0].querySelector('a');
      const napName = napLink ? napLink.textContent.trim() : cells[0].textContent.trim();
      const editUrl = napLink ? napLink.getAttribute('href') : null;
      
      mappings.push({
        napName,
        routesetDefinition: cells[1].textContent.trim(),
        routesetDigitmap: cells[2].textContent.trim(),
        editUrl
      });
    }
  }
  
  return mappings;
};

// Helper function to parse NAP edit form
const parseNapEditForm = (html) => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  
  // Extract form data
  const form = doc.querySelector('form');
  if (!form) {
    // Debug: print the first 1000 characters of the HTML response
    console.error('DEBUG: NAP edit form not found. HTML response preview:');
    if (typeof html === 'string') {
      console.error(html.substring(0, 1000));
    } else {
      console.error('[Non-string HTML response]');
    }
    throw new Error('NAP edit form not found');
  }
  
  // Get current values
  const priority = doc.querySelector('#tbgw_nap_priority')?.value || '';
  const weight = doc.querySelector('#tbgw_nap_weight')?.value || '';
  const calledPreRemap = doc.querySelector('#tbgw_nap_called_pre_remap')?.value || '';
  
  // Get available files from dropdowns
  const definitionOptions = Array.from(doc.querySelectorAll('#tbgw_nap_routesets_definition option'))
    .map(option => ({ value: option.value, text: option.textContent.trim() }))
    .filter(option => option.value !== '');
    
  const digitmapOptions = Array.from(doc.querySelectorAll('#tbgw_nap_routesets_digitmap option'))
    .map(option => ({ value: option.value, text: option.textContent.trim() }))
    .filter(option => option.value !== '');
  
  // Get current selections
  const currentDefinition = doc.querySelector('#tbgw_nap_routesets_definition')?.value || '';
  const currentDigitmap = doc.querySelector('#tbgw_nap_routesets_digitmap')?.value || '';
  
  // Get hidden form fields
  const authenticityToken = doc.querySelector('input[name="authenticity_token"]')?.value || '';
  const tbgwConfigurationId = doc.querySelector('#tbgw_nap_tbgw_configuration_id_hidden')?.value || '';
  const napId = doc.querySelector('#tbgw_nap_nap_id_hidden')?.value || '';
  
  return {
    formData: {
      priority,
      weight,
      calledPreRemap,
      currentDefinition,
      currentDigitmap,
      authenticityToken,
      tbgwConfigurationId,
      napId
    },
    availableFiles: {
      definitions: definitionOptions,
      digitmaps: digitmapOptions
    }
  };
};

// Get all routeset mappings
const getRoutesetMappings = async (configId = null, instanceId = null) => {
  try {
    console.log(`[RoutesetMapping] Fetching routeset mappings for config: ${configId || 'default'}, instance: ${instanceId || 'default'}`);
    const apiClient = await getApiClient(instanceId);
    console.log(`[RoutesetMapping] Using base URL: ${apiClient.defaults.baseURL}`);
    const response = await apiClient.get('/routesets');
    if (response.status === 200) {
      const mappings = parseRoutesetMappings(response.data);
      console.log('Successfully parsed routeset mappings:', mappings);
      return mappings;
    } else {
      throw new Error(`Failed to fetch routeset mappings: ${response.status}`);
    }
  } catch (error) {
    console.error('Error fetching routeset mappings:', error);
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check your credentials.');
    }
    throw new Error(`Failed to fetch routeset mappings: ${error.message}`);
  }
};

// Get NAP edit form data (including available files)
const getNapEditData = async (napName, configId = null, instanceId = null) => {
  try {
    console.log(`Fetching edit data for NAP: ${napName}, config: ${configId || 'default'}, instance: ${instanceId || 'default'}`);
    const apiClient = await getApiClient(instanceId);
    const editUrl = `/nap_columns_values/${napName}/edit?from_controller=tbgw_routesets`;
    const response = await apiClient.get(editUrl);
    if (response.status === 200) {
      const editData = parseNapEditForm(response.data);
      console.log('Successfully parsed NAP edit data:', editData);
      return editData;
    } else {
      throw new Error(`Failed to fetch NAP edit data: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error fetching NAP edit data for ${napName}:`, error);
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check your credentials.');
    }
    throw new Error(`Failed to fetch NAP edit data: ${error.message}`);
  }
};

// Update NAP mapping
const updateNapMapping = async (napName, mappingData, configId = null, instanceId = null) => {
  try {
    console.log(`Updating NAP mapping for: ${napName}`, mappingData);
    // First get the current form data to extract hidden fields
    const editData = await getNapEditData(napName, configId, instanceId);
    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('_method', 'put');
    formData.append('authenticity_token', editData.formData.authenticityToken);
    formData.append('tbgw_nap[priority]', mappingData.priority || editData.formData.priority);
    formData.append('tbgw_nap[weight]', mappingData.weight || editData.formData.weight);
    formData.append('tbgw_nap[called_pre_remap]', mappingData.calledPreRemap || editData.formData.calledPreRemap);
    formData.append('tbgw_nap[routesets_definition]', mappingData.routesetDefinition || '');
    formData.append('tbgw_nap[routesets_digitmap]', mappingData.routesetDigitmap || '');
    formData.append('tbgw_nap[tbgw_configuration_id]', editData.formData.tbgwConfigurationId);
    formData.append('tbgw_nap[nap_id]', editData.formData.napId);
    formData.append('tbgw_nap[from_controller]', 'tbgw_routesets');
    formData.append('commit', 'Save');
    const apiClient = await getApiClient(instanceId);
    const response = await apiClient.post(`/nap_columns_values/${napName}`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html, application/json, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)'
      },
      maxRedirects: 0, // Don't follow redirects automatically
      validateStatus: (status) => status < 400 || status === 302 // Accept 302 redirects as success
    });
    console.log('NAP mapping update response:', response.status);
    if (response.status === 302 || response.status === 200) {
      console.log('Successfully updated NAP mapping');
      return { success: true, message: 'NAP mapping updated successfully' };
    } else {
      throw new Error(`Unexpected response status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error updating NAP mapping for ${napName}:`, error);
    if (error.response?.status === 302) {
      // 302 redirect is actually success in this case
      console.log('Update successful (redirect response)');
      return { success: true, message: 'NAP mapping updated successfully' };
    }
    if (error.code === 'ERR_NETWORK' && error.message.includes('Network Error')) {
      // This often happens with CORS on redirects, but if we got here, the update likely succeeded
      console.log('Network error on redirect - update likely successful');
      return { success: true, message: 'NAP mapping updated successfully' };
    }
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check your credentials.');
    }
    throw new Error(`Failed to update NAP mapping: ${error.message}`);
  }
};

// Get available files for dropdowns
const getAvailableFiles = async (configId = null, instanceId = null) => {
  try {
    console.log(`Fetching available files for config: ${configId || 'default'}, instance: ${instanceId || 'default'}`);
    const mappings = await getRoutesetMappings(configId, instanceId);
    if (mappings.length === 0) {
      return { definitions: [], digitmaps: [] };
    }

    // Try each NAP until we find one with a valid edit form
    for (const mapping of mappings) {
      try {
        // Skip undefined NAPs
        if (!mapping.napName || mapping.napName === 'undefined') continue;
        const editData = await getNapEditData(mapping.napName, configId, instanceId);
        if (editData && editData.availableFiles) {
          return editData.availableFiles;
        }
      } catch (err) {
        // Log and continue to next NAP
        console.warn(`Skipping NAP '${mapping.napName}': ${err.message}`);
        continue;
      }
    }
    // If none found, throw error
    throw new Error('No valid NAP edit form found for any NAP.');
  } catch (error) {
    console.error('Error fetching available files:', error);
    throw new Error(`Failed to fetch available files: ${error.message}`);
  }
};

// Generate routing database
const generateRoutingDatabase = async (systemId = '1', instanceId = null) => {
  try {
    console.log(`Generating routing database for system: ${systemId}...`);
    const apiClient = await getApiClient(instanceId);
    // First get the routesets page to extract the CSRF token and session info
    const response = await apiClient.get('/routesets');
    const dom = new JSDOM(response.data);
    const doc = dom.window.document;
    // Extract CSRF token from various possible sources
    let authenticityToken = '';
    console.log('Attempting to extract authenticity token...');
    // Method 1: Try to find CSRF token from meta tag first
    const csrfMeta = doc.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) {
      authenticityToken = csrfMeta.getAttribute('content');
      console.log('Found token in meta tag:', authenticityToken);
    }
    // Method 2: If not found, try to find it in any form input
    if (!authenticityToken) {
      const tokenInput = doc.querySelector('input[name="authenticity_token"]');
      if (tokenInput) {
        authenticityToken = tokenInput.value;
        console.log('Found token in form input:', authenticityToken);
      }
    }
    // Method 3: Try to extract from the generate button onclick attribute
    if (!authenticityToken) {
      const generateButton = doc.querySelector('input[name="GenerateButton"], input[value*="Generate"], button[onclick*="authenticity_token"]');
      if (generateButton) {
        const onclickAttr = generateButton.getAttribute('onclick') || '';
        console.log('Generate button onclick:', onclickAttr);
        const tokenMatch = onclickAttr.match(/authenticity_token[=:]([^&'";,\s]+)/);
        if (tokenMatch) {
          authenticityToken = decodeURIComponent(tokenMatch[1]);
          console.log('Found token in onclick:', authenticityToken);
        }
      }
    }
    // Method 4: Try to find in any onclick attribute containing authenticity_token
    if (!authenticityToken) {
      const elementsWithOnclick = doc.querySelectorAll('[onclick*="authenticity_token"]');
      for (const element of elementsWithOnclick) {
        const onclickAttr = element.getAttribute('onclick') || '';
        const tokenMatch = onclickAttr.match(/authenticity_token[=:]([^&'";,\s]+)/);
        if (tokenMatch) {
          authenticityToken = decodeURIComponent(tokenMatch[1]);
          console.log('Found token in element onclick:', authenticityToken);
          break;
        }
      }
    }
    // Method 5: Search in all script tags for authenticity_token
    if (!authenticityToken) {
      const scripts = doc.querySelectorAll('script');
      for (const script of scripts) {
        const scriptContent = script.textContent || '';
        const tokenMatch = scriptContent.match(/authenticity_token['":\s]*['"]([^'"]+)['"]/);
        if (tokenMatch) {
          authenticityToken = tokenMatch[1];
          console.log('Found token in script:', authenticityToken);
          break;
        }
      }
    }
    // Method 6: Try to get a new token by making a fresh request to a form page
    if (!authenticityToken) {
      console.log('Token not found in routesets page, trying to get from NAP edit page...');
      try {
        const mappings = await getRoutesetMappings(null, instanceId);
        if (mappings.length > 0) {
          const editData = await getNapEditData(mappings[0].napName, null, instanceId);
          authenticityToken = editData.formData.authenticityToken;
          console.log('Found token from NAP edit page:', authenticityToken);
        }
      } catch (error) {
        console.log('Could not get token from NAP edit page:', error.message);
      }
    }
    if (!authenticityToken) {
      console.error('Failed to extract authenticity token. Page HTML structure may have changed.');
      console.log('Available meta tags:', Array.from(doc.querySelectorAll('meta')).map(m => ({name: m.name, content: m.content})));
      console.log('Available forms:', Array.from(doc.querySelectorAll('form')).length);
      console.log('Available inputs with authenticity_token:', Array.from(doc.querySelectorAll('input[name="authenticity_token"]')).length);
      throw new Error('Could not extract authenticity token from page. Please check if you are properly authenticated.');
    }
    console.log('Found authenticity token, making generate request...', authenticityToken.substring(0, 10) + '...');
    // Prepare the form data exactly as shown in the network log
    const formData = new URLSearchParams();
    formData.append('authenticity_token', authenticityToken);
    formData.append('_', ''); // Empty underscore parameter as shown in network log
    console.log('Sending generate request with payload:', formData.toString());
    // Make the AJAX request to generate routes with exact headers from network log
    const generateResponse = await apiClient.post(`/tbgw_routesets/ajax_generate_routes/${systemId}`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'text/javascript, text/html, application/xml, text/xml, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Prototype-Version': '1.6.0.3',
        'Cache-Control': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)'
      },
      timeout: 60000, // Increased timeout to 60 seconds for generation
    });
    console.log('Routing database generation response:', {
      status: generateResponse.status,
      statusText: generateResponse.statusText,
      headers: generateResponse.headers,
      dataLength: generateResponse.data?.length || 0,
      dataPreview: typeof generateResponse.data === 'string' ? 
        generateResponse.data.substring(0, 200) : 
        generateResponse.data
    });
    if (generateResponse.status === 200) {
      const responseText = generateResponse.data;
      // Look for success indicators in the response
      if (typeof responseText === 'string') {
        const lowerResponse = responseText.toLowerCase();
        // Check for various success indicators
        if (lowerResponse.includes('success') || 
            lowerResponse.includes('generated') ||
            lowerResponse.includes('route database was generated successfully') ||
            lowerResponse.includes('generation complete') ||
            lowerResponse.includes('flash') ||
            responseText.length > 0) {
          console.log('✅ Routing database generation successful');
          return { 
            success: true, 
            message: 'Route database was generated successfully',
            response: responseText 
          };
        } else if (responseText.trim() === '') {
          // Empty response might also indicate success for AJAX calls
          console.log('✅ Routing database generation completed (empty response)');
          return { 
            success: true, 
            message: 'Routing database generation completed',
            response: 'Generation completed successfully' 
          };
        } else {
          console.warn('⚠️ Generation completed but response format unexpected:', responseText);
          return { 
            success: true, 
            message: 'Routing database generation completed (unrecognized response format)',
            response: responseText 
          };
        }
      } else {
        console.log('✅ Routing database generation completed (non-string response)');
        return { 
          success: true, 
          message: 'Routing database generation completed',
          response: JSON.stringify(responseText) 
        };
      }
    } else {
      throw new Error(`Unexpected response status: ${generateResponse.status} - ${generateResponse.statusText}`);
    }
  } catch (error) {
    console.error('❌ Error generating routing database:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code
    });
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check your credentials and try logging in again.');
    }
    if (error.response?.status === 403) {
      throw new Error('Access forbidden. You may not have permission to generate routing database.');
    }
    if (error.response?.status === 404) {
      throw new Error('Generate routes endpoint not found. The server configuration may have changed.');
    }
    if (error.response?.status === 422) {
      throw new Error('Invalid request. The authenticity token may be expired or invalid.');
    }
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Generation request timed out after 60 seconds. The process may still be running on the server.');
    }
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Network error occurred. Please check your connection and try again.');
    }
    // Provide the original error message for debugging
    throw new Error(`Failed to generate routing database: ${error.message}`);
  }
};

// Activate configuration
const activateConfiguration = async (configurationId = null, systemId = '1', instanceId = null) => {
  try {
    console.log(`Activating configuration with ID: ${configurationId} for system: ${systemId}`);
    const apiClient = await getApiClient(instanceId);
    
    // First get the systems page to extract the CSRF token
    const response = await apiClient.get(`/systems/${systemId}/edit`);
    const dom = new JSDOM(response.data);
    const doc = dom.window.document;
    
    // Extract CSRF token from the form
    const tokenInput = doc.querySelector('input[name="authenticity_token"]');
    if (!tokenInput) {
      throw new Error('Could not extract authenticity token from systems page');
    }
    const authenticityToken = tokenInput.value;
    
    console.log('Making configuration activation request...');
    
    // Prepare the form data
    const formData = new URLSearchParams();
    formData.append('system_info[configuration_id]', configurationId.toString());
    formData.append('authenticity_token', authenticityToken);
    formData.append('_', '');
    
    // Make the AJAX request to activate configuration
    const activateResponse = await apiClient.post(`/system_info/activate_configuration/${systemId}`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'text/javascript, text/html, application/xml, text/xml, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Prototype-Version': '1.6.0.3',
        'Cache-Control': 'no-cache',
      },
      timeout: 30000, // 30 seconds timeout
    });
    
    console.log('Configuration activation response:', {
      status: activateResponse.status,
      statusText: activateResponse.statusText,
      headers: activateResponse.headers,
      dataLength: activateResponse.data?.length || 0,
      dataPreview: typeof activateResponse.data === 'string' ? 
        activateResponse.data.substring(0, 500) : 
        activateResponse.data
    });
    
    if (activateResponse.status === 200) {
      const responseText = activateResponse.data;
      
      // Look for success/error indicators in the response
      if (typeof responseText === 'string') {
        const lowerResponse = responseText.toLowerCase();
        
        // Check for error indicators first
        if (lowerResponse.includes('error') || 
            lowerResponse.includes('failed') ||
            lowerResponse.includes('exception')) {
          console.warn('⚠️ Configuration activation may have failed:', responseText);
          return { 
            success: false, 
            message: 'Configuration activation failed - check server response',
            response: responseText 
          };
        }
        
        // Check for success indicators
        if (lowerResponse.includes('success') || 
            lowerResponse.includes('activated') ||
            lowerResponse.includes('configuration activated') ||
            lowerResponse.includes('flash') ||
            responseText.length > 0) {
          
          console.log('✅ Configuration activation successful');
          return { 
            success: true, 
            message: 'Configuration activated successfully',
            response: responseText 
          };
        } else if (responseText.trim() === '') {
          // Empty response might also indicate success for AJAX calls
          console.log('✅ Configuration activation completed (empty response)');
          return { 
            success: true, 
            message: 'Configuration activation completed',
            response: 'Activation completed successfully' 
          };
        } else {
          console.warn('⚠️ Activation completed but response format unexpected:', responseText);
          return { 
            success: true, 
            message: 'Configuration activation completed (unrecognized response format)',
            response: responseText 
          };
        }
      } else {
        console.log('✅ Configuration activation completed (non-string response)');
        return { 
          success: true, 
          message: 'Configuration activation completed',
          response: JSON.stringify(responseText) 
        };
      }
    } else {
      throw new Error(`Unexpected response status: ${activateResponse.status} - ${activateResponse.statusText}`);
    }
  } catch (error) {
    console.error('❌ Error activating configuration:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code
    });
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check your credentials and try logging in again.');
    }
    
    if (error.response?.status === 403) {
      throw new Error('Access forbidden. You may not have permission to activate configurations.');
    }
    
    if (error.response?.status === 404) {
      throw new Error('Activation endpoint not found. The server configuration may have changed.');
    }
    
    if (error.response?.status === 422) {
      throw new Error('Invalid request. The authenticity token may be expired or invalid.');
    }
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      throw new Error('Activation request timed out after 30 seconds. The process may still be running on the server.');
    }
    
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Network error occurred. Please check your connection and try again.');
    }
    
    // Provide the original error message for debugging
    throw new Error(`Failed to activate configuration: ${error.message}`);
  }
};

// Get available configurations
const getAvailableConfigurations = async (systemId = '1', instanceId = null) => {
  try {
    console.log(`Fetching available configurations for system: ${systemId}...`);
    const apiClient = await getApiClient(instanceId);
    let response;
    try {
      response = await apiClient.get(`/systems/${systemId}/edit`);
    } catch (err) {
      // Axios error: log details
      if (err.response) {
        console.error(`Failed to fetch /systems/${systemId}/edit:`, {
          status: err.response.status,
          statusText: err.response.statusText,
          headers: err.response.headers,
          dataPreview: typeof err.response.data === 'string' ? err.response.data.substring(0, 500) : err.response.data
        });
      } else if (err.request) {
        console.error(`No response received from /systems/${systemId}/edit:`, err.request);
      } else {
        console.error(`Error setting up request to /systems/${systemId}/edit:`, err.message);
      }
      throw new Error(`Failed to fetch /systems/${systemId}/edit from ProSBC. See logs for details.`);
    }

    if (!response.data) {
      console.error(`No response data received from /systems/${systemId}/edit.`);
      throw new Error(`No response data received from ProSBC /systems/${systemId}/edit.`);
    }

    // If response is JSON (object), extract configurations from it
    if (typeof response.data === 'object' && !Array.isArray(response.data)) {
      const data = response.data;
      // Try to extract configuration info from known keys
      let configs = [];
      if (data.validate_configuration_results) {
        // Each key except '***meta***' is a config
        for (const [key, value] of Object.entries(data.validate_configuration_results)) {
          if (key === '***meta***') continue;
          configs.push({
            id: key,
            name: key,
            isSelected: data.active_configuration === key,
            ...value
          });
        }
      } else if (data.active_configuration) {
        // Fallback: just show the active config
        configs.push({
          id: data.active_configuration,
          name: data.active_configuration,
          isSelected: true
        });
      }
      console.log('Available configurations (from JSON):', configs);
      return configs;
    }

    // Otherwise, treat as HTML
    if (typeof response.data === 'string') {
      const dom = new JSDOM(response.data);
      const doc = dom.window.document;

      // Extract configurations from the activation dropdown
      const configSelect = doc.querySelector('#system_info_configuration_id');
      if (!configSelect) {
        // Debug: print the first 500 characters of the HTML response
        const htmlPreview = response.data && typeof response.data === 'string'
          ? response.data.substring(0, 5000)
          : '[No HTML response]';
        console.error('Configuration dropdown not found. HTML preview:', htmlPreview);
        throw new Error('Configuration dropdown not found on systems page');
      }
      
      const configurations = Array.from(configSelect.querySelectorAll('option'))
        .map(option => ({
          id: parseInt(option.value),
          name: option.textContent.trim(),
          isSelected: option.hasAttribute('selected')
        }))
        .filter(config => !isNaN(config.id));
      
      console.log('Available configurations:', configurations);
      return configurations;
    }

    // If neither JSON nor HTML, throw error
    console.error(`Unknown response type from /systems/${systemId}/edit:`, typeof response.data);
    throw new Error(`Unknown response type from ProSBC /systems/${systemId}/edit.`);
  } catch (error) {
    console.error('Error fetching available configurations:', error);
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check your credentials.');
    }
    throw new Error(`Failed to fetch available configurations: ${error.message}`);
  }
};

// Validate configuration
const validateConfiguration = async (configurationId = null, systemId = '1', instanceId = null) => {
  try {
    console.log(`Validating configuration with ID: ${configurationId} for system: ${systemId}`);
    const apiClient = await getApiClient(instanceId);
    // First get the systems page to extract the CSRF token
    const response = await apiClient.get(`/systems/${systemId}/edit`);
    const dom = new JSDOM(response.data);
    const doc = dom.window.document;
    // Extract CSRF token from the form
    const tokenInput = doc.querySelector('input[name="authenticity_token"]');
    if (!tokenInput) {
      throw new Error('Could not extract authenticity token from systems page');
    }
    const authenticityToken = tokenInput.value;
    console.log('Making configuration validation request...');
    // Prepare the form data
    const formData = new URLSearchParams();
    formData.append('system_info[configuration_id_validate]', configurationId.toString());
    formData.append('authenticity_token', authenticityToken);
    formData.append('_', '');
    // Make the AJAX request to validate configuration
    const validateResponse = await apiClient.post(`/system_info/validate_configuration/${systemId}`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept': 'text/javascript, text/html, application/xml, text/xml, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Prototype-Version': '1.6.0.3',
      },
      timeout: 30000,
    });
    console.log('Configuration validation response:', {
      status: validateResponse.status,
      statusText: validateResponse.statusText,
      dataLength: validateResponse.data?.length || 0
    });
    if (validateResponse.status === 200) {
      const responseText = validateResponse.data;
      console.log('✅ Configuration validation completed');
      return { 
        success: true, 
        message: 'Configuration validation completed',
        response: responseText 
      };
    } else {
      throw new Error(`Unexpected response status: ${validateResponse.status}`);
    }
  } catch (error) {
    console.error('❌ Error validating configuration:', error);
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please check your credentials.');
    }
    throw new Error(`Failed to validate configuration: ${error.message}`);
  }
};

// Export all functions as ES module default
export default {
  getRoutesetMappings,
  getNapEditData,
  updateNapMapping,
  getAvailableFiles,
  generateRoutingDatabase,
  activateConfiguration,
  getAvailableConfigurations,
  validateConfiguration,
  clearSessionCache
};