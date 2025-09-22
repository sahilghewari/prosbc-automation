// Enhanced NAP API Client - ProSBC Workflow Implementation
// This implementation follows the exact ProSBC NAP creation workflow you described:
// 1. POST to /naps with basic data (name only)
// 2. ProSBC redirects to /naps/{id}/edit
// 3. PUT to /naps/{id} with full configuration
// 4. Add SIP Transport Servers via /nap/add_sip_sap/{id}
// 5. Add Port Ranges via /nap/add_port_range/{id}

import fetch from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import https from 'https';
import 'dotenv/config';


// Get credentials from environment variables
const getCredentials = () => {
  const username = process.env.PROSBC_USERNAME;
  const password = process.env.PROSBC_PASSWORD;

  if (!username || !password) {
    throw new Error('ProSBC credentials not found. Please set VITE_PROSBC_USERNAME and VITE_PROSBC_PASSWORD in your .env file');
  }
  
  return { username, password };
};


// Create fetch client with cookie jar and custom agent for ProSBC
const createApiClient = () => {
  const credentials = getCredentials();
  const jar = new CookieJar();
  const agent = new https.Agent({ rejectUnauthorized: false });
  const baseUrl = process.env.PROSBC_BASE_URL;
  const fetchWithCookies = fetchCookie(fetch, jar);

  // Helper for requests
  async function request(path, options = {}) {
    const url = baseUrl.replace(/\/$/, '') + path;
    const headers = Object.assign({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Authorization': 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')
    }, options.headers || {});
    const opts = Object.assign({}, options, { headers, agent });
    // Log request for debugging
    console.log(`NAP API Request: ${opts.method || 'GET'} ${url}`);
    if (opts.body && opts.body instanceof URLSearchParams) {
      console.log('Request payload (FormData):', Object.fromEntries(opts.body.entries()));
    }
    const res = await fetchWithCookies(url, opts);
    // Log response for debugging
    console.log(`NAP API Response: ${res.status} ${res.statusText}`);
    return res;
  }

  return { request, jar };
};

// Navigate to SIP configuration section and establish proper session
const navigateToSipSection = async (client) => {
  try {
    console.log('Navigating to SIP configuration section...');
    
    // First, try to establish a proper ProSBC session by logging in
    await establishProSBCSession(client);
    
    // Then get the main configuration page
    const mainResponseRes = await client.request('/configurations', {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const mainResponse = { status: mainResponseRes.status, data: await mainResponseRes.text() };
    
    console.log('Main configuration response status:', mainResponse.status);
    
    // Try to navigate to SIP section specifically
    try {
      const sipRes = await client.request('/configurations/1/sip', {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
      const sipResponse = { status: sipRes.status, data: await sipRes.text() };
      console.log('SIP section navigation successful');
      return sipResponse;
    } catch (sipError) {
      console.log('Direct SIP navigation failed, trying alternative routes...');
      
      // Try alternative SIP navigation paths
      const altPaths = [
        '/configurations/1/sip/naps',
        '/sip/naps',
        '/sip_cfg',
        '/configurations/1'
      ];
      
      for (const path of altPaths) {
        try {
          console.log(`Trying navigation path: ${path}`);
          const altRes = await client.request(path, { method: 'GET' });
          const altResponse = { status: altRes.status, data: await altRes.text() };
          console.log(`Successfully navigated to: ${path}`);
          return altResponse;
        } catch (altError) {
          console.log(`Failed to navigate to ${path}: ${altError.message}`);
        }
      }
      
      // Return main response if all navigation attempts fail
      console.log('Using main configuration page as fallback');
      return mainResponse;
    }
    
  } catch (error) {
    console.error('Navigation to SIP section failed:', error);
    throw error;
  }
};

// Establish proper ProSBC session by logging in
const establishProSBCSession = async (client) => {
  try {
    console.log('Establishing ProSBC session...');
    
    // First, get the login page to extract CSRF token
    const loginPageRes = await client.request('/login', {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const loginPageResponse = { status: loginPageRes.status, data: await loginPageRes.text() };
    
    console.log('Login page response status:', loginPageResponse.status);
    
    // Check if we're already logged in (might get redirected to main page)
    if (loginPageResponse.data && !loginPageResponse.data.includes('login') && 
        !loginPageResponse.data.includes('Username') && loginPageResponse.data.includes('Configuration')) {
      console.log('Already logged in to ProSBC');
      return;
    }
    
    // Extract CSRF token from login page
    const loginHtml = loginPageResponse.data;
    const csrfMatch = loginHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/i);
    
    if (!csrfMatch || !csrfMatch[1]) {
      console.warn('Could not extract CSRF token from login page, proceeding without session login');
      return;
    }
    
    const loginCsrfToken = csrfMatch[1];
    console.log('Extracted login CSRF token');
    
    // Get credentials
    const credentials = getCredentials();
    
    // Perform login
    const loginPayload = new URLSearchParams();
    loginPayload.append('authenticity_token', loginCsrfToken);
    loginPayload.append('user[name]', credentials.username);
    loginPayload.append('user[pass]', credentials.password);
    loginPayload.append('commit', 'Login');
    
    console.log('Performing ProSBC login...');
    
    const loginRes = await client.request('/login/check', {
      method: 'POST',
      body: loginPayload.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const loginResponse = { status: loginRes.status, data: await loginRes.text() };
    
    console.log('Login response status:', loginResponse.status);
    
    // Check if login was successful
    if (loginResponse.data && loginResponse.data.includes('Configuration')) {
      console.log('ProSBC session established successfully');
    } else if (loginResponse.data && loginResponse.data.includes('login')) {
      throw new Error('ProSBC login failed - check credentials');
    } else {
      console.log('Login response unclear, proceeding with session');
    }
    
  } catch (error) {
    console.warn('Session establishment failed:', error.message);
    console.log('Proceeding with Basic Auth only');
  }
};

// Get or create CSRF token from ProSBC session
const getCsrfToken = async (client) => {
  try {
    console.log('Fetching CSRF token from ProSBC...');
    
    // First, navigate to SIP configuration section
    await navigateToSipSection(client);
    
    // Now try to get the NAP list page to extract CSRF token
    const napListUrls = ['/naps', '/configurations/1/sip/naps', '/sip/naps'];
    let response = null;
    
    for (const url of napListUrls) {
      try {
        console.log(`Trying to access NAP list at: ${url}`);
        const res = await client.request(url, {
          method: 'GET',
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        response = { status: res.status, data: await res.text() };
        
        // Check if this response contains NAP-related content
        const html = response.data;
        if (html.includes('nap') || html.includes('NAP') || html.includes('Network Access Point')) {
          console.log(`Found NAP content at: ${url}`);
          break;
        } else {
          console.log(`No NAP content found at: ${url}, trying next...`);
          response = null;
        }
      } catch (error) {
        console.log(`Failed to access ${url}: ${error.message}`);
      }
    }
    
    if (!response) {
      // Fallback: try to get CSRF from the new NAP page
      console.log('Trying to access new NAP creation page...');
      const newNapUrls = ['/naps/new', '/configurations/1/sip/naps/new', '/sip/naps/new'];
      
      for (const url of newNapUrls) {
        try {
          const res = await client.request(url, {
            method: 'GET',
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
          response = { status: res.status, data: await res.text() };
          console.log(`Successfully accessed new NAP page at: ${url}`);
          break;
        } catch (error) {
          console.log(`Failed to access new NAP page at ${url}: ${error.message}`);
        }
      }
    }
    
    if (!response) {
      throw new Error('Could not access any NAP-related pages in ProSBC');
    }
    
    let html = response.data;
    console.log('Received HTML response, extracting CSRF token...');
    
    // Check if we got a proper page with forms (should have authenticity_token)
    if (!html.includes('authenticity_token') && !html.includes('csrf')) {
      console.log('No CSRF token found on /naps page, trying /naps/new...');
      
      try {
        const res = await client.request('/naps/new', { method: 'GET' });
        response = { status: res.status, data: await res.text() };
        html = response.data;
      } catch (newPageError) {
        console.log('Failed to get /naps/new page:', newPageError.message);
        
        // Try the main configuration page
        console.log('Trying main configuration page...');
        try {
          const res = await client.request('/', { method: 'GET' });
          response = { status: res.status, data: await res.text() };
          html = response.data;
        } catch (mainPageError) {
          console.log('Failed to get main page:', mainPageError.message);
        }
      }
    }
    
    // Try multiple patterns to extract CSRF token (more comprehensive)
    const tokenPatterns = [
      // Standard Rails authenticity token patterns
      /name="authenticity_token"[^>]*value="([^"]+)"/i,
      /authenticity_token"[^>]*value='([^']+)'/i,
      /<input[^>]*name="authenticity_token"[^>]*value="([^"]+)"[^>]*>/i,
      /<input[^>]*value="([^"]+)"[^>]*name="authenticity_token"[^>]*>/i,
      
      // Meta tag patterns
      /<meta[^>]*name="csrf-token"[^>]*content="([^"]+)"[^>]*>/i,
      /<meta[^>]*name="authenticity_token"[^>]*content="([^"]+)"[^>]*>/i,
      /<meta[^>]*content="([^"]+)"[^>]*name="csrf-token"[^>]*>/i,
      
      // JavaScript variable patterns
      /authenticity_token[^=]*=[^"']*["']([^"']+)["']/i,
      /csrf_token[^=]*=[^"']*["']([^"']+)["']/i,
      /window\.csrfToken[^=]*=[^"']*["']([^"']+)["']/i,
      
      // Form token patterns
      /token[^=]*=[^"']*["']([a-zA-Z0-9+\/=]{20,})["']/i
    ];
    
    // Try regex patterns first
    for (const pattern of tokenPatterns) {
      const tokenMatch = html.match(pattern);
      if (tokenMatch && tokenMatch[1] && tokenMatch[1].length > 10) {
        const token = tokenMatch[1];
        
        // Validate that the token doesn't contain JavaScript code
        if (!token.includes('encodeURIComponent') && 
            !token.includes('function') && 
            !token.includes('var') && 
            !token.includes('let') && 
            !token.includes('const') &&
            !token.includes('window.') &&
            !token.includes('document.') &&
            !token.includes(' + ') &&
            !token.includes('(') &&
            !token.includes(')') &&
            /^[a-zA-Z0-9+\/=_-]+$/.test(token)) {
          console.log('CSRF token extracted successfully via regex');
          return token;
        } else {
          console.log(`Skipping invalid token containing JavaScript: ${token.substring(0, 50)}...`);
        }
      }
    }
    
    // Try parsing as DOM if regex fails
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Look for authenticity token in various forms
      const selectors = [
        'input[name="authenticity_token"]',
        'meta[name="csrf-token"]',
        'meta[name="authenticity_token"]',
        'input[name="csrf_token"]',
        'input[type="hidden"][name*="token"]'
      ];
      
      for (const selector of selectors) {
        const element = doc.querySelector(selector);
        if (element) {
          const token = element.getAttribute('value') || 
                       element.getAttribute('content') ||
                       element.getAttribute('data-value');
          if (token && token.length > 10) {
            // Validate that the token doesn't contain JavaScript code
            if (!token.includes('encodeURIComponent') && 
                !token.includes('function') && 
                !token.includes('var') && 
                !token.includes('let') && 
                !token.includes('const') &&
                !token.includes('window.') &&
                !token.includes('document.') &&
                !token.includes(' + ') &&
                !token.includes('(') &&
                !token.includes(')') &&
                /^[a-zA-Z0-9+\/=_-]+$/.test(token)) {
              console.log(`CSRF token extracted via DOM parsing (${selector})`);
              return token;
            } else {
              console.log(`Skipping invalid DOM token containing JavaScript: ${token.substring(0, 50)}...`);
            }
          }
        }
      }
      
      // Look for any hidden input that might contain a token
      const hiddenInputs = doc.querySelectorAll('input[type="hidden"]');
      for (const input of hiddenInputs) {
        const value = input.getAttribute('value');
        const name = input.getAttribute('name');
        if (value && value.length > 20) {
          // Validate that it's a clean token without JavaScript
          if (!value.includes('encodeURIComponent') && 
              !value.includes('function') && 
              !value.includes('var') && 
              !value.includes('let') && 
              !value.includes('const') &&
              !value.includes('window.') &&
              !value.includes('document.') &&
              !value.includes(' + ') &&
              !value.includes('(') &&
              !value.includes(')') &&
              /^[a-zA-Z0-9+\/=_-]+$/.test(value)) {
            console.log(`Potential CSRF token found in hidden input: ${name}`);
            return value;
          } else {
            console.log(`Skipping invalid hidden input token: ${name} = ${value.substring(0, 50)}...`);
          }
        }
      }
      
    } catch (domError) {
      console.log('DOM parsing failed:', domError.message);
    }
    
    // If still no token found, try to create a new session
    console.log('No token found on /naps page, trying /naps/new...');
    try {
      const newRes = await client.request('/naps/new', { method: 'GET' });
      const newResponse = { status: newRes.status, data: await newRes.text() };
      const newHtml = newResponse.data;
      
      for (const pattern of tokenPatterns) {
        const tokenMatch = newHtml.match(pattern);
        if (tokenMatch && tokenMatch[1] && tokenMatch[1].length > 10) {
          const token = tokenMatch[1];
          
          // Validate that the token doesn't contain JavaScript code
          if (!token.includes('encodeURIComponent') && 
              !token.includes('function') && 
              !token.includes('var') && 
              !token.includes('let') && 
              !token.includes('const') &&
              !token.includes('window.') &&
              !token.includes('document.') &&
              !token.includes(' + ') &&
              !token.includes('(') &&
              !token.includes(')') &&
              /^[a-zA-Z0-9+\/=_-]+$/.test(token)) {
            console.log('CSRF token extracted from /naps/new page');
            return token;
          } else {
            console.log(`Skipping invalid /naps/new token containing JavaScript: ${token.substring(0, 50)}...`);
          }
        }
      }
    } catch (newPageError) {
      console.log('Failed to get /naps/new page:', newPageError.message);
    }
    
    // Try to extract any token-like string as last resort
    const tokenLikePattern = /[a-zA-Z0-9+\/]{40,}={0,2}/g;
    const tokenMatches = html.match(tokenLikePattern);
    if (tokenMatches && tokenMatches.length > 0) {
      console.log('Found potential token-like strings:', tokenMatches.slice(0, 3));
      // Filter out any matches that contain JavaScript code or invalid characters
      const validTokens = tokenMatches.filter(token => 
        !token.includes('encodeURIComponent') && 
        !token.includes('function') && 
        !token.includes('var') && 
        !token.includes('let') && 
        !token.includes('const') &&
        /^[a-zA-Z0-9+\/=]+$/.test(token) &&
        token.length >= 20
      );
      
      if (validTokens.length > 0) {
        const token = validTokens[0];
        console.log('Using filtered valid token:', token.substring(0, 10) + '...');
        return token;
      }
    }
    
    // If still no valid token, try to force a new session
    console.warn('No valid CSRF token found, attempting to generate a new one...');
    try {
      // Try to force a new session by accessing the login page again
      const freshLoginRes = await client.request('/login', {
        method: 'GET',
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Cache-Control': 'no-cache'
        }
      });
      const freshLoginResponse = { status: freshLoginRes.status, data: await freshLoginRes.text() };
      
      const freshHtml = freshLoginResponse.data;
      const freshTokenMatch = freshHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/i);
      if (freshTokenMatch && freshTokenMatch[1] && freshTokenMatch[1].length > 10) {
        const token = freshTokenMatch[1];
        
        // Validate that the token doesn't contain JavaScript code
        if (!token.includes('encodeURIComponent') && 
            !token.includes('function') && 
            !token.includes('var') && 
            !token.includes('let') && 
            !token.includes('const') &&
            !token.includes('window.') &&
            !token.includes('document.') &&
            !token.includes(' + ') &&
            !token.includes('(') &&
            !token.includes(')') &&
            /^[a-zA-Z0-9+\/=_-]+$/.test(token)) {
          console.log('Extracted fresh CSRF token from new login page');
          return token;
        } else {
          console.log(`Skipping invalid fresh token containing JavaScript: ${token.substring(0, 50)}...`);
        }
      }
    } catch (freshError) {
      console.log('Failed to get fresh CSRF token:', freshError.message);
    }
    
    throw new Error('Could not extract CSRF token from ProSBC session - no token patterns found');
    
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data preview:', error.response.data?.substring(0, 500));
    }
    
    throw new Error(`Failed to establish ProSBC session: ${error.message}`);
  }
};

// Extract NAP ID from ProSBC response (redirect or success page)
const extractNapIdFromRedirect = (response, napName = null) => {
  console.log('Extracting NAP ID from response...');
  console.log('Response status:', response.status);
  console.log('Response headers:', response.headers);
  
  // Handle redirect case first - prioritize Location header
  let location = '';
  
  // Try multiple sources for the redirect URL
  if (response.headers && response.headers.location) {
    location = response.headers.location;
  } else if (response.headers && response.headers.Location) {
    location = response.headers.Location;
  } else if (response.request && response.request.responseURL) {
    location = response.request.responseURL;
  } else if (response.config && response.config.url) {
    location = response.config.url;
  }
  
  console.log('Checking for NAP ID in location:', location);
  
  // If we have a location, try to extract NAP ID from it
  if (location) {
    // Clean up the location URL - remove proxy prefix if present
    let cleanLocation = location;
    if (cleanLocation.includes('/api/')) {
      cleanLocation = cleanLocation.substring(cleanLocation.indexOf('/api/') + 4);
    }
    
    // Remove server prefix if it's there (e.g., https://prosbc2tpa2.dipvtel.com:12358)
    if (cleanLocation.includes('://')) {
      const urlParts = cleanLocation.split('/');
      cleanLocation = '/' + urlParts.slice(3).join('/'); // Keep everything after the domain
    }
    
    console.log('Cleaned location for NAP ID extraction:', cleanLocation);
    
    // Try different patterns to match NAP ID from redirect
    const patterns = [
      /\/naps\/(\d+)(?:\/edit)?(?:\?.*)?$/,
      /\/naps\/(\d+)(?:\/.*)?$/,
      /nap.*?(\d+)/i,
      /\/(\d+)(?:\/edit)?(?:\?.*)?$/
    ];
    
    for (const pattern of patterns) {
      const match = cleanLocation.match(pattern);
      if (match && match[1]) {
        const napId = match[1];
        console.log(`NAP ID extracted from redirect location: ${napId}`);
        return napId;
      }
    }
  }
  
  // If redirect didn't work, try to extract from response body
  if (response.data && typeof response.data === 'string') {
    console.log('Trying to extract NAP ID from response body...');
    
    // If we have the NAP name, look for it in the response and find nearby NAP ID
    if (napName) {
      console.log(`Looking for NAP "${napName}" in response...`);
      
      // Try to find the NAP name in the HTML and extract ID from nearby elements
      const parser = new DOMParser();
      try {
        const doc = parser.parseFromString(response.data, 'text/html');
        
        // Look for table rows containing the NAP name
        const tableRows = doc.querySelectorAll('tr');
        for (const row of tableRows) {
          const rowText = row.textContent || '';
          if (rowText.includes(napName)) {
            console.log('Found NAP name in table row:', rowText);
            
            // Look for edit links in this row
            const editLink = row.querySelector('a[href*="/naps/"][href*="/edit"]') ||
                           row.querySelector('a.edit_link') ||
                           row.querySelector('a[href*="/naps/"]');
            
            if (editLink) {
              const href = editLink.getAttribute('href');
              console.log('Found edit link:', href);
              
              const idMatch = href.match(/\/naps\/(\d+)/);
              if (idMatch && idMatch[1]) {
                console.log(`NAP ID extracted from edit link: ${idMatch[1]}`);
                return idMatch[1];
              }
            }
            
            // Also look for any numeric patterns in the row
            const numberMatches = rowText.match(/\b(\d+)\b/g);
            if (numberMatches) {
              // Take the first reasonable number (NAP IDs are usually small)
              for (const num of numberMatches) {
                if (num.length <= 6 && parseInt(num) > 0) {
                  console.log(`Potential NAP ID found in row: ${num}`);
                  return num;
                }
              }
            }
          }
        }
        
        // If no specific row found, look for the most recent NAP ID
        const allEditLinks = doc.querySelectorAll('a[href*="/naps/"][href*="/edit"]');
        if (allEditLinks.length > 0) {
          // Get the last edit link (most recently created)
          const lastLink = allEditLinks[allEditLinks.length - 1];
          const href = lastLink.getAttribute('href');
          const idMatch = href.match(/\/naps\/(\d+)/);
          if (idMatch && idMatch[1]) {
            console.log(`Using most recent NAP ID: ${idMatch[1]}`);
            return idMatch[1];
          }
        }
        
      } catch (parseError) {
        console.log('DOM parsing failed:', parseError.message);
      }
    }
    
    // Fallback: look for any NAP ID patterns in the response body
    const bodyPatterns = [
      /\/naps\/(\d+)(?:\/edit)?/g,
      /nap.*?id[^0-9]*(\d+)/gi,
      /edit.*?nap[^0-9]*(\d+)/gi,
      /created.*?nap[^0-9]*(\d+)/gi
    ];
    
    for (const pattern of bodyPatterns) {
      const matches = [...response.data.matchAll(pattern)];
      if (matches.length > 0) {
        const napId = matches[matches.length - 1][1]; // Use the last match (most recent)
        console.log(`NAP ID extracted from response body: ${napId}`);
        
        if (/^\d{1,10}$/.test(napId)) {
          return napId;
        }
      }
    }
    
    // Log response body sample for debugging
    console.log('Response body sample (first 2000 chars):');
    console.log(response.data.substring(0, 2000));
  }
  
  // Try getting NAP ID from the request URL if it was a successful request
  if (response.status < 300 && response.config?.url) {
    const urlMatch = response.config.url.match(/\/naps\/(\d+)/);
    if (urlMatch && urlMatch[1]) {
      console.log(`NAP ID extracted from request URL: ${urlMatch[1]}`);
      return urlMatch[1];
    }
  }
  
  console.warn('Could not extract NAP ID. Response details:', {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    url: response.config?.url,
    hasData: !!response.data,
    napName: napName
  });
  
  // Return null instead of throwing error - we'll handle this gracefully
  return null;
};

// Extract NAP ID from NAP list response by finding a NAP with the given name
const extractNapIdFromList = (napListHtml, napName) => {
  console.log('Extracting NAP ID from list for NAP name:', napName);
  
  if (!napListHtml || typeof napListHtml !== 'string') {
    console.log('No valid NAP list HTML provided');
    return null;
  }
  
  if (!napName) {
    console.log('No NAP name provided for matching');
    return null;
  }
  
  console.log('NAP list HTML length:', napListHtml.length);
  
  try {
    // Look for table rows containing the NAP name and extract the ID
    // Pattern: <tr class="odd/even">...<td>NAP_NAME</td>...<a href="/naps/ID/edit">Edit</a>...
    
    // First, find all table rows that might contain NAP information
    const rowMatches = napListHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
    
    if (rowMatches) {
      console.log(`Found ${rowMatches.length} table rows to check`);
      
      for (let i = 0; i < rowMatches.length; i++) {
        const row = rowMatches[i];
        
        // Check if this row contains our NAP name
        if (row.includes(napName)) {
          console.log(`Found row containing NAP name "${napName}"`);
          console.log('Row content:', row.substring(0, 500) + '...');
          
          // Try to extract NAP ID from edit links in this row
          const editLinkPatterns = [
            /href=["']\/naps\/(\d+)\/edit["']/i,
            /href=["'][^"']*\/naps\/(\d+)\/edit["']/i,
            /href=["'][^"']*\/naps\/(\d+)["']/i,
            /"\/naps\/(\d+)\/edit"/i,
            /'\/naps\/(\d+)\/edit'/i
          ];
          
          for (const pattern of editLinkPatterns) {
            const match = row.match(pattern);
            if (match && match[1]) {
              const napId = match[1];
              console.log(`✓ Extracted NAP ID ${napId} from list for "${napName}"`);
              return napId;
            }
          }
          
          // Also try to extract from any links containing the NAP name
          const generalLinkPattern = new RegExp(`href=["'][^"']*\/naps\/(\\d+)[^"']*["'][^>]*>[^<]*${napName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          const generalMatch = row.match(generalLinkPattern);
          if (generalMatch && generalMatch[1]) {
            const napId = generalMatch[1];
            console.log(`✓ Extracted NAP ID ${napId} from general link pattern for "${napName}"`);
            return napId;
          }
        }
      }
    }
    
    // Fallback: look for the NAP name anywhere in the HTML and try to find nearby NAP IDs
    console.log('Fallback: Looking for NAP name anywhere in the HTML...');
    
    const napNameIndex = napListHtml.indexOf(napName);
    if (napNameIndex !== -1) {
      console.log(`Found NAP name "${napName}" at position ${napNameIndex}`);
      
      // Look for NAP IDs in the surrounding context (before and after the name)
      const contextBefore = napListHtml.substring(Math.max(0, napNameIndex - 1000), napNameIndex);
      const contextAfter = napListHtml.substring(napNameIndex, napNameIndex + 1000);
      const fullContext = contextBefore + napName + contextAfter;
      
      const contextPatterns = [
        /\/naps\/(\d+)\/edit/gi,
        /\/naps\/(\d+)/gi,
        /nap[_-]?id["'\s]*:?["'\s]*(\d+)/gi,
        /id["'\s]*:?["'\s]*(\d+)[^0-9]/gi
      ];
      
      for (const pattern of contextPatterns) {
        const matches = fullContext.match(pattern);
        if (matches && matches.length > 0) {
          // Get the ID from the first match
          const idMatch = matches[0].match(/(\d+)/);
          if (idMatch && idMatch[1]) {
            const napId = idMatch[1];
            console.log(`✓ Extracted NAP ID ${napId} from context around "${napName}"`);
            return napId;
          }
        }
      }
    }
    
    console.log(`Could not find NAP ID for "${napName}" in the NAP list`);
    return null;
    
  } catch (error) {
    console.error('Error extracting NAP ID from list:', error);
    return null;
  }
};

// Get the most recently created NAP ID from the NAP list
const getLatestNapId = async (client, napName = null) => {
  try {
    console.log('Fetching NAP list to find latest NAP ID...');
    
    // Try multiple NAP list URLs
    const napListUrls = [
      '/naps',
      '/configurations/1/sip/naps',
      '/sip/naps',
      '/sip_naps'
    ];
    
    let response = null;
    let html = '';
    
    for (const url of napListUrls) {
      try {
        console.log(`Trying NAP list URL: ${url}`);
        response = await client.get(url);
        html = response.data;
        
        console.log(`NAP list response from ${url} - length:`, html.length);
        console.log('NAP list HTML sample (first 1500 chars):', html.substring(0, 1500));
        
        // Check if this response contains NAP-related content
        if (html.includes('nap') || html.includes('NAP') || html.includes('Network Access Point') || 
            html.includes('<table') || html.includes('edit') || html.includes('href="/naps/')) {
          console.log(`Found NAP content at: ${url}`);
          break;
        } else {
          console.log(`No NAP content found at: ${url}, trying next...`);
          response = null;
        }
      } catch (error) {
        console.log(`Failed to access ${url}: ${error.message}`);
      }
    }
    
    if (!response) {
      throw new Error('Could not access any NAP list pages in ProSBC');
    }
    
    // Check if we're actually on the NAP page or got redirected somewhere else
    if (html.includes('Web Configuration Tool') && !html.includes('nap') && !html.includes('NAP')) {
      console.warn('Response appears to be a general configuration page, not the NAP list page');
      
      // Let's try to see what's in the response more thoroughly
      console.log('Full page HTML (first 3000 chars):');
      console.log(html.substring(0, 3000));
      
      // Check if there's any indication of where we are
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        console.log('Page title:', titleMatch[1]);
      }
      
      // Try another common URL pattern
      try {
        const configResponse = await client.get('/nap_configurations');
        const configHtml = configResponse.data;
        console.log('NAP configuration page length:', configHtml.length);
        
        if (configHtml.length > html.length || configHtml.toLowerCase().includes('nap')) {
          console.log('Using NAP configuration page response');
          html = configHtml;
        }
      } catch (configError) {
        console.log('NAP configuration URL failed:', configError.message);
      }
    }
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // First, let's examine the overall page structure
    console.log('Page title:', doc.title);
    console.log('Body classes:', doc.body?.className || 'none');
    
    // Look for all tables in the page
    const tables = doc.querySelectorAll('table');
    console.log(`Found ${tables.length} tables in the page`);
    
    // Examine each table
    tables.forEach((table, i) => {
      const rows = table.querySelectorAll('tr');
      console.log(`Table ${i + 1}: ${rows.length} rows`);
      
      // Check the first few rows for header information
      for (let j = 0; j < Math.min(3, rows.length); j++) {
        const row = rows[j];
        const cells = row.querySelectorAll('td, th');
        const cellTexts = Array.from(cells).map(cell => 
          cell.textContent?.trim()?.substring(0, 30) || '').filter(text => text);
        if (cellTexts.length > 0) {
          console.log(`  Table ${i + 1}, Row ${j + 1}: [${cellTexts.join(' | ')}]`);
        }
      }
    });
    
    // Look for all links in the page, not just specific selectors
    const allLinks = doc.querySelectorAll('a[href]');
    console.log(`Total links in page: ${allLinks.length}`);
    
    // Filter for NAP-related links
    const napRelatedLinks = Array.from(allLinks).filter(link => {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim() || '';
      return href && (
        href.includes('/naps/') || 
        href.includes('/nap/') ||
        text.toLowerCase().includes('edit') ||
        text.toLowerCase().includes('nap')
      );
    });
    
    console.log(`NAP-related links found: ${napRelatedLinks.length}`);
    napRelatedLinks.forEach((link, i) => {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim() || '';
      const title = link.getAttribute('title') || '';
      console.log(`  NAP Link ${i + 1}: href="${href}", text="${text.substring(0, 30)}", title="${title}"`);
    });
    
    // Look for all possible NAP links (more flexible patterns)
    const linkSelectors = [
      'a[href*="/naps/"][href*="/edit"]',
      'a.edit_link', 
      'a[href*="/naps/"]',
      'a[title*="Edit"]',
      'a[title*="edit"]',
      'a[class*="edit"]',
      'a[href*="edit"]'
    ];
    
    let editLinks = [];
    for (const selector of linkSelectors) {
      const links = doc.querySelectorAll(selector);
      console.log(`Selector "${selector}" found ${links.length} links`);
      if (links.length > 0) {
        editLinks = editLinks.concat(Array.from(links));
      }
    }
    
    // Remove duplicates
    editLinks = [...new Set(editLinks)];
    console.log(`Found ${editLinks.length} total unique potential NAP edit links`);
    
    // Debug: log all links found for analysis
    for (let i = 0; i < Math.min(editLinks.length, 10); i++) {
      const link = editLinks[i];
      const href = link.getAttribute('href');
      const text = link.textContent?.trim() || '';
      const title = link.getAttribute('title') || '';
      const className = link.className || '';
      console.log(`Edit Link ${i + 1}: href="${href}", text="${text.substring(0, 40)}", title="${title}", class="${className}"`);
    }
    
    const napIds = [];
    
    for (const link of editLinks) {
      const href = link.getAttribute('href');
      const name = link.textContent?.trim();
      
      if (href) {
        // Try multiple patterns to extract NAP ID
        const patterns = [
          /\/naps\/(\d+)\/edit/,
          /\/naps\/(\d+)/,
          /\/nap\/(\d+)/,
          /nap[^0-9]*(\d+)/i,
          /edit[^0-9]*(\d+)/i,
          /(\d+)/
        ];
        
        let napId = null;
        for (const pattern of patterns) {
          const idMatch = href.match(pattern);
          if (idMatch && idMatch[1] && /^\d+$/.test(idMatch[1])) {
            napId = parseInt(idMatch[1]);
            console.log(`Extracted NAP ID ${napId} from "${href}" using pattern ${pattern}`);
            break;
          }
        }
        
        if (napId && napId > 0) {
          napIds.push({ id: napId, name: name || 'Unknown', href });
          
          console.log(`Found NAP: ID=${napId}, name="${name}", href="${href}"`);
          
          // If we're looking for a specific NAP name, check for it
          if (napName && name && name.toLowerCase().includes(napName.toLowerCase())) {
            console.log(`Found NAP "${napName}" with ID: ${napId}`);
            return napId.toString();
          }
        }
      }
    }
    
    // If no specific NAP name was provided or found, look for any table structure
    if (napIds.length === 0) {
      console.log('No NAP links found, trying detailed table-based search...');
      
      // Look for any table that might contain NAP data
      for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
        const table = tables[tableIndex];
        const rows = table.querySelectorAll('tr');
        
        console.log(`Examining table ${tableIndex + 1} with ${rows.length} rows`);
        
        // Skip header row(s) and examine data rows
        for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
          const row = rows[rowIndex];
          const cells = row.querySelectorAll('td');
          
          if (cells.length > 0) {
            const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
            console.log(`    Row ${rowIndex + 1}: [${cellTexts.join(' | ')}]`);
            
            // Look for anything that might be a NAP ID or name
            for (let cellIndex = 0; cellIndex < cells.length; cellIndex++) {
              const cellText = cellTexts[cellIndex];
              const cell = cells[cellIndex];
              
              // Check if this cell contains a number that could be a NAP ID
              const numberMatch = cellText.match(/^\d+$/);
              if (numberMatch && parseInt(cellText) > 0 && parseInt(cellText) < 100000) {
                console.log(`    Potential NAP ID in row ${rowIndex + 1}, cell ${cellIndex + 1}: ${cellText}`);
                
                // If looking for a specific NAP, check if the name appears in this row
                if (napName) {
                  const rowText = cellTexts.join(' ').toLowerCase();
                  if (rowText.includes(napName.toLowerCase())) {
                    console.log(`    Found NAP name "${napName}" in this row - using ID: ${cellText}`);
                    return cellText;
                  }
                } else {
                  // Add to potential NAP IDs
                  napIds.push({ id: parseInt(cellText), name: cellTexts.join(' | '), href: `#table-${tableIndex}-row-${rowIndex}` });
                }
              }
              
              // Check if this cell contains links
              const cellLinks = cell.querySelectorAll('a');
              if (cellLinks.length > 0) {
                console.log(`    Cell ${cellIndex + 1} contains ${cellLinks.length} links`);
                for (const cellLink of cellLinks) {
                  const linkHref = cellLink.getAttribute('href');
                  const linkText = cellLink.textContent?.trim();
                  console.log(`      Link: href="${linkHref}", text="${linkText}"`);
                  
                  // Try to extract NAP ID from this link too
                  if (linkHref) {
                    const linkIdMatch = linkHref.match(/\/naps?\/(\d+)/);
                    if (linkIdMatch && linkIdMatch[1]) {
                      const linkNapId = parseInt(linkIdMatch[1]);
                      napIds.push({ id: linkNapId, name: linkText || cellTexts.join(' | '), href: linkHref });
                      console.log(`      Extracted NAP ID ${linkNapId} from cell link`);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    // Sort by ID descending to get the latest
    napIds.sort((a, b) => b.id - a.id);
    
    if (napIds.length > 0) {
      const latestId = napIds[0].id.toString();
      console.log(`Latest NAP ID found: ${latestId} (${napIds[0].name})`);
      return latestId;
    }
    
    console.log('No NAP IDs found in the response');
    return null;
    
  } catch (error) {
    console.error('Failed to get latest NAP ID:', error);
    return null;
  }
};

// Main NAP creation function - Using proven working approach from original client
export const createNapWithProSBCWorkflow = async (napConfig) => {
  const client = createApiClient();
  
  try {
    console.log('Creating NAP with ProSBC workflow...', napConfig);
    
    // Step 0: Navigate to the correct SIP configuration section
    console.log('Step 0: Navigating to SIP configuration section...');
    await navigateToSipSection(client);
    
    // Step 1: Get CSRF token after proper navigation
    console.log('Step 1: Getting CSRF token...');
    const csrfToken = await getCsrfToken(client);
    console.log('CSRF token obtained:', csrfToken ? 'Yes' : 'No');
    
    // Validate CSRF token before using it
    if (!csrfToken || typeof csrfToken !== 'string' || csrfToken.length < 10) {
      throw new Error(`Invalid CSRF token received: ${csrfToken}`);
    }
    
    // Check for JavaScript code in the token (should be a clean base64-like string)
    if (csrfToken.includes('encodeURIComponent') || csrfToken.includes('function') || 
        csrfToken.includes('var') || csrfToken.includes('let') || csrfToken.includes('const') ||
        csrfToken.includes('+') && csrfToken.includes('(')) {
      throw new Error(`CSRF token contains JavaScript code: ${csrfToken.substring(0, 100)}...`);
    }
    
    console.log('✓ CSRF token validated successfully:', csrfToken.substring(0, 10) + '...');
    
    // Step 2: Create initial NAP with basic data (following exact ProSBC form structure)
    const initialPayload = new URLSearchParams();
    initialPayload.append('authenticity_token', csrfToken); // Use the actual CSRF token
    initialPayload.append('nap[name]', napConfig.name);
    initialPayload.append('nap[enabled]', '0'); // Hidden field for Rails checkbox
    initialPayload.append('nap[enabled]', napConfig.enabled !== false ? '1' : '0');
    initialPayload.append('nap[profile_id]', napConfig.profile_id || '1'); // Must be numeric
    initialPayload.append('nap[get_stats_on_leg_termination]', 'true');
    // Rate limiting (default values)
    initialPayload.append('nap[rate_limit_cps]', '0');
    initialPayload.append('nap[rate_limit_cps_in]', '0');
    initialPayload.append('nap[rate_limit_cps_out]', '0');
    initialPayload.append('nap[max_incoming_calls]', '0');
    initialPayload.append('nap[max_outgoing_calls]', '0');
    initialPayload.append('nap[max_incoming_outgoing_calls]', '0');
    initialPayload.append('nap[rate_limit_delay_low]', '3');
    initialPayload.append('nap[rate_limit_delay_low_unit_conversion]', '1000.0');
    initialPayload.append('nap[rate_limit_delay_high]', '6');
    initialPayload.append('nap[rate_limit_delay_high_unit_conversion]', '1000.0');
    initialPayload.append('nap[rate_limit_cpu_usage_low]', '0');
    initialPayload.append('nap[rate_limit_cpu_usage_high]', '0');
    // Congestion threshold (default values)
    initialPayload.append('nap[congestion_threshold_nb_calls]', '1');
    initialPayload.append('nap[congestion_threshold_period_sec]', '1');
    initialPayload.append('nap[congestion_threshold_period_sec_unit_conversion]', '60.0');
    // Configuration and commit
    initialPayload.append('nap[configuration_id]', '1');
    initialPayload.append('commit', 'Create');

    console.log('Step 2: Creating initial NAP at /naps');
    console.log('Initial payload values:');
    for (const [key, value] of initialPayload.entries()) {
      console.log(`  ${key}: ${value.substring ? value.substring(0, 50) + (value.length > 50 ? '...' : '') : value}`);
    }

    let napId;
    const createRes = await client.request('/naps', {
      method: 'POST',
      body: initialPayload.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'manual' // Don't auto-follow redirects
    });
    const createResponse = {
      status: createRes.status,
      statusText: createRes.statusText,
      headers: Object.fromEntries(createRes.headers.entries()),
      data: await createRes.text(),
      url: createRes.url
    };
    console.log('SUCCESS: NAP creation response received');
    console.log('Response status:', createResponse.status);
    console.log('Response headers:', createResponse.headers);
    console.log('Response data preview (first 2000 chars):', createResponse.data && createResponse.data.substring ? createResponse.data.substring(0, 2000) : '');
    napId = extractNapIdFromRedirect(createResponse, napConfig.name);
    
    if (!napId && createResponse.status >= 300 && createResponse.status < 400) {
      console.log('Redirect detected but no NAP ID extracted, checking location header...');
      const location = createResponse.headers.location || createResponse.headers.Location;
      if (location) {
        console.log('Redirect location:', location);
        const match = location.match(/\/naps\/(\d+)/);
        if (match) {
          napId = match[1];
          console.log(`NAP ID extracted from location header: ${napId}`);
        }
      }
    }
    
    if (napId) {
      console.log(`Step 2 successful: NAP created with ID ${napId}`);
    } else {
      // If we got 200, try to find the NAP ID from the response or NAP list
      console.log('Could not extract NAP ID from response, trying to find newly created NAP...');
      
      // Wait a moment for the NAP to be created in the database
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      napId = await getLatestNapId(client, napConfig.name);
      if (napId) {
        console.log(`Found newly created NAP with ID: ${napId}`);
      }
    }

    if (!napId) {
      // Try fallback: get latest NAP ID
      console.log('Could not extract NAP ID from redirect, trying fallback...');
      
      // Wait a bit more and try again
      await new Promise(resolve => setTimeout(resolve, 2000));
      napId = await getLatestNapId(client, napConfig.name);
      
      if (!napId) {
        // Let's check the response body for error messages
        if (createResponse.data && typeof createResponse.data === 'string') {
          console.log('Response body sample:', createResponse.data.substring(0, 1000));
          
          // Check for specific error patterns in the response
          if (createResponse.data.includes('error') || createResponse.data.includes('Error')) {
            throw new Error('NAP creation failed - ProSBC returned an error in the response');
          }
          
          if (createResponse.data.includes('already exists') || createResponse.data.includes('duplicate')) {
            throw new Error(`NAP creation failed - NAP name "${napConfig.name}" already exists`);
          }
        }
        
        // Even if we can't get the NAP ID, the NAP might have been created
        // Let's return success but without the ID
        return {
          success: true,
          message: `NAP "${napConfig.name}" appears to have been created successfully (ID could not be determined)`,
          napId: null,
          warning: 'NAP created but ID could not be determined for further configuration'
        };
      }
    }

    // Step 3: If we have additional configuration, update the NAP
    if (napId && (napConfig.sip_destination_ip || Object.keys(napConfig).length > 3)) {
      console.log(`Step 3: Configuring NAP ${napId} with detailed settings`);
      
      const updatePayload = new URLSearchParams();
      updatePayload.append('_method', 'put');
      updatePayload.append('authenticity_token', csrfToken); // Use the same CSRF token
      
      // Basic settings
      updatePayload.append('nap[name]', napConfig.name);
      updatePayload.append('nap[enabled]', '0');
      updatePayload.append('nap[enabled]', napConfig.enabled !== false ? '1' : '0');
      updatePayload.append('nap[profile_id]', napConfig.profile_id || '1');
      updatePayload.append('nap[get_stats_on_leg_termination]', 'true');

      // SIP Configuration
      if (napConfig.sip_destination_ip) {
        updatePayload.append('nap_sip_cfg[sip_use_proxy]', '0');
        updatePayload.append('nap_sip_cfg[sip_use_proxy]', '1');
        updatePayload.append('nap[sip_destination_ip]', napConfig.sip_destination_ip);
        updatePayload.append('nap[sip_destination_port]', napConfig.sip_destination_port || '5060');
        updatePayload.append('nap_sip_cfg[filter_by_remote_port]', '0');
        updatePayload.append('nap_sip_cfg[filter_by_remote_port]', napConfig.filter_by_proxy_port !== false ? '1' : '0');
        updatePayload.append('nap_sip_cfg[poll_proxy]', '0');
        updatePayload.append('nap_sip_cfg[poll_proxy]', napConfig.poll_remote_proxy !== false ? '1' : '0');
        updatePayload.append('nap_sip_cfg[proxy_polling_interval]', napConfig.proxy_polling_interval || '1');
        updatePayload.append('nap_sip_cfg[proxy_polling_interval_unit_conversion]', napConfig.proxy_polling_interval_unit || '60000.0');
      }

      // Authentication
      if (napConfig.sip_auth_user || napConfig.authUser) {
        updatePayload.append('nap[sip_auth_ignore_realm]', '0');
        updatePayload.append('nap[sip_auth_ignore_realm]', napConfig.sip_auth_ignore_realm || napConfig.ignoreRealm ? '1' : '0');
        updatePayload.append('nap[sip_auth_reuse_challenge]', '0');
        updatePayload.append('nap[sip_auth_reuse_challenge]', napConfig.sip_auth_reuse_challenge || napConfig.reuseChallenge ? '1' : '0');
        updatePayload.append('nap[sip_auth_realm]', napConfig.sip_auth_realm || napConfig.realm || '');
        updatePayload.append('nap[sip_auth_user]', napConfig.sip_auth_user || napConfig.authUser || '');
        updatePayload.append('nap[sip_auth_pass]', napConfig.sip_auth_pass || napConfig.authPassword || '');
      }

      // Apply user-specified rate limits and congestion settings
      updatePayload.append('nap[rate_limit_cps]', napConfig.rate_limit_cps || napConfig.rateLimitCps || '0');
      updatePayload.append('nap[rate_limit_cps_in]', napConfig.rate_limit_cps_in || napConfig.rateLimitCpsIn || '0');
      updatePayload.append('nap[rate_limit_cps_out]', napConfig.rate_limit_cps_out || napConfig.rateLimitCpsOut || '0');
      updatePayload.append('nap[max_incoming_calls]', napConfig.max_incoming_calls || napConfig.maxIncomingCalls || '0');
      updatePayload.append('nap[max_outgoing_calls]', napConfig.max_outgoing_calls || napConfig.maxOutgoingCalls || '0');
      updatePayload.append('nap[max_incoming_outgoing_calls]', napConfig.max_total_calls || napConfig.maxTotalCalls || '0');
      updatePayload.append('nap[congestion_threshold_nb_calls]', napConfig.congestion_nb_calls || napConfig.congestionNbCalls || '1');
      updatePayload.append('nap[congestion_threshold_period_sec]', napConfig.congestion_period || napConfig.congestionPeriod || '1');
      updatePayload.append('nap[congestion_threshold_period_sec_unit_conversion]', napConfig.congestion_period_unit || napConfig.congestionPeriodUnit || '60.0');

      updatePayload.append('nap[configuration_id]', '1');
      updatePayload.append('commit', 'Save');

      console.log('Update payload keys:', Array.from(updatePayload.keys()));

      try {
        const updateRes = await client.request(`/naps/${napId}`, {
          method: 'POST',
          body: updatePayload.toString(),
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        console.log('NAP configuration updated, status:', updateRes.status);
      } catch (updateError) {
        console.warn('NAP update failed, but basic NAP was created:', updateError.message);
      }
    }

    // Step 4: Add SIP Transport Servers (if any)
    if (napId && napConfig.sip_servers && napConfig.sip_servers.length > 0) {
      console.log('Step 4: Adding SIP Transport Servers...');
      
      for (const serverId of napConfig.sip_servers) {
        try {
          const sipPayload = new URLSearchParams();
          sipPayload.append('authenticity_token', csrfToken);
          sipPayload.append('sip_sap[][sip_sap]', serverId);

          console.log(`Adding SIP server ${serverId}...`);

          await client.request(`/nap/add_sip_sap/${napId}`, {
            method: 'POST',
            body: sipPayload.toString(),
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });

          console.log(`SIP server ${serverId} added successfully`);
        } catch (error) {
          console.warn(`Failed to add SIP server ${serverId}:`, error.message);
        }
      }
      
      console.log(`Processed ${napConfig.sip_servers.length} SIP Transport Servers`);
    }
    
    // Step 5: Add Port Ranges (if any)
    if (napId && napConfig.port_ranges && napConfig.port_ranges.length > 0) {
      console.log('Step 5: Adding Port Ranges...');
      
      for (const rangeId of napConfig.port_ranges) {
        try {
          const portPayload = new URLSearchParams();
          portPayload.append('authenticity_token', csrfToken);
          portPayload.append('port_range[][port_range]', rangeId);
          
          console.log(`Adding port range ${rangeId}...`);
          
          await client.request(`/nap/add_port_range/${napId}`, {
            method: 'POST',
            body: portPayload.toString(),
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
          
          console.log(`Port range ${rangeId} added successfully`);
        } catch (error) {
          console.warn(`Failed to add port range ${rangeId}:`, error.message);
        }
      }
      
      console.log(`Processed ${napConfig.port_ranges.length} Port Ranges`);
    }

    console.log('NAP creation workflow completed successfully');
    
    return {
      success: true,
      message: `NAP "${napConfig.name}" created successfully`,
      napId: napId,
      editUrl: napId ? `/naps/${napId}/edit` : null
    };
    
  } catch (error) {
    console.error('NAP creation workflow failed:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to create NAP',
      napId: null
    };
  }
};

// Build complete NAP payload for single-step creation
const buildCompleteNapPayload = (config, csrfToken) => {
  const payload = new URLSearchParams();
  
  // Form metadata
  payload.append('authenticity_token', csrfToken);
  
  // Basic NAP Configuration
  payload.append('nap[name]', config.name);
  payload.append('nap[enabled]', '0'); // Rails checkbox pattern
  payload.append('nap[enabled]', config.enabled !== false ? '1' : '0');
  payload.append('nap[profile_id]', config.profile_id || '1');
  payload.append('nap[get_stats_on_leg_termination]', 'true');
  payload.append('nap[configuration_id]', '1');
  
  // SIP Proxy Configuration
  const useProxy = Boolean(config.sip_destination_ip);
  payload.append('nap_sip_cfg[sip_use_proxy]', '0');
  payload.append('nap_sip_cfg[sip_use_proxy]', useProxy ? '1' : '0');
  
  if (useProxy || config.sip_destination_ip) {
    payload.append('nap[sip_destination_ip]', config.sip_destination_ip || '');
    payload.append('nap[sip_destination_port]', config.sip_destination_port || '5060');
    payload.append('nap_sip_cfg[filter_by_remote_port]', '0');
    payload.append('nap_sip_cfg[filter_by_remote_port]', config.filter_by_proxy_port !== false ? '1' : '0');
    payload.append('nap_sip_cfg[poll_proxy]', '0');
    payload.append('nap_sip_cfg[poll_proxy]', config.poll_remote_proxy !== false ? '1' : '0');
    payload.append('nap_sip_cfg[proxy_polling_interval]', config.proxy_polling_interval || '1');
    payload.append('nap_sip_cfg[proxy_polling_interval_unit_conversion]', config.proxy_polling_interval_unit || '60000.0');
  }
  
  // Accept only authorized users
  payload.append('nap_sip_cfg[accept_only_authorized_users]', '0');
  payload.append('nap_sip_cfg[accept_only_authorized_users]', config.accept_only_authorized_users ? '1' : '0');
  
  // Registration Parameters
  payload.append('nap_sip_cfg[register_to_proxy]', '0');
  payload.append('nap_sip_cfg[register_to_proxy]', config.register_to_proxy ? '1' : '0');
  if (config.aor || config.addressToRegister) {
    payload.append('nap_sip_cfg[aor]', config.aor || config.addressToRegister || '');
  }
  
  // Authentication Parameters
  payload.append('nap[sip_auth_ignore_realm]', '0');
  payload.append('nap[sip_auth_ignore_realm]', config.sip_auth_ignore_realm || config.ignoreRealm ? '1' : '0');
  payload.append('nap[sip_auth_reuse_challenge]', '0');
  payload.append('nap[sip_auth_reuse_challenge]', config.sip_auth_reuse_challenge || config.reuseChallenge ? '1' : '0');
  
  if (config.sip_auth_realm || config.realm) {
    payload.append('nap[sip_auth_realm]', config.sip_auth_realm || config.realm || '');
  }
  if (config.sip_auth_user || config.authUser) {
    payload.append('nap[sip_auth_user]', config.sip_auth_user || config.authUser || '');
  }
  if (config.sip_auth_pass || config.authPassword) {
    payload.append('nap[sip_auth_pass]', config.sip_auth_pass || config.authPassword || '');
  }
  
  // NAT Parameters
  payload.append('nap_sip_cfg[remote_nat_traversal_method_id]', config.remote_nat_rtp || config.remoteNatRtp || '0');
  payload.append('nap_sip_cfg[remote_sip_nat_traversal_method_id]', config.remote_nat_sip || config.remoteNatSip || '0');
  if (config.local_nat_rtp || config.localNatRtp) {
    payload.append('nap_sip_cfg[nat_cfg_id]', config.local_nat_rtp || config.localNatRtp || '');
  }
  if (config.local_nat_sip || config.localNatSip) {
    payload.append('nap_sip_cfg[nat_cfg_sip_id]', config.local_nat_sip || config.localNatSip || '');
  }
  
  // SIP-I Parameters
  payload.append('nap_sip_cfg[sipi_enable]', '0');
  payload.append('nap_sip_cfg[sipi_enable]', config.sipi_enable || config.sipiEnable ? '1' : '0');
  payload.append('nap_sip_cfg[sipi_isup_protocol_variant_id]', config.isup_protocol_variant || config.isupProtocolVariant || '5');
  payload.append('nap_sip_cfg[sipi_version]', config.sipi_version || config.sipiVersion || 'itu-t');
  payload.append('nap_sip_cfg[sipi_use_info_progress]', config.sipi_use_info_progress || config.sipiUseInfoProgress || '0');
  payload.append('nap_tdm_cfg[append_trailing_f_to_number]', '0');
  payload.append('nap_tdm_cfg[append_trailing_f_to_number]', config.append_trailing_f || config.appendTrailingF ? '1' : '0');
  
  // Advanced Parameters
  payload.append('nap_sip_cfg[poll_proxy_ping_quirk]', '0');
  payload.append('nap_sip_cfg[poll_proxy_ping_quirk]', config.poll_proxy_ping_quirk !== false && config.pollProxyPingQuirk !== false ? '1' : '0');
  payload.append('nap_sip_cfg[proxy_polling_response_timeout]', config.response_timeout || config.responseTimeout || '12');
  payload.append('nap_sip_cfg[proxy_polling_response_timeout_unit_conversion]', config.response_timeout_unit || config.responseTimeoutUnit || '1000.0');
  payload.append('nap_sip_cfg[proxy_polling_max_forwards]', config.max_forwards || config.maxForwards || '1');
  payload.append('nap_sip_cfg[sip_183_call_progress]', '0');
  payload.append('nap_sip_cfg[sip_183_call_progress]', config.sip_183_call_progress || config.sip183CallProgress ? '1' : '0');
  payload.append('nap_sip_cfg[sip_privacy_type_id]', config.privacy_type || config.privacyType || '3');
  
  // Call Rate Limiting
  payload.append('nap[rate_limit_cps]', config.rate_limit_cps || config.rateLimitCps || '0');
  payload.append('nap[rate_limit_cps_in]', config.rate_limit_cps_in || config.rateLimitCpsIn || '0');
  payload.append('nap[rate_limit_cps_out]', config.rate_limit_cps_out || config.rateLimitCpsOut || '0');
  payload.append('nap[max_incoming_calls]', config.max_incoming_calls || config.maxIncomingCalls || '0');
  payload.append('nap[max_outgoing_calls]', config.max_outgoing_calls || config.maxOutgoingCalls || '0');
  payload.append('nap[max_incoming_outgoing_calls]', config.max_total_calls || config.maxTotalCalls || '0');
  payload.append('nap[rate_limit_delay_low]', config.delay_low_threshold || config.delayLowThreshold || '3');
  payload.append('nap[rate_limit_delay_low_unit_conversion]', config.delay_low_unit || config.delayLowUnit || '1.0');
  payload.append('nap[rate_limit_delay_high]', config.delay_high_threshold || config.delayHighThreshold || '6');
  payload.append('nap[rate_limit_delay_high_unit_conversion]', config.delay_high_unit || config.delayHighUnit || '1.0');
  payload.append('nap[rate_limit_cpu_usage_low]', '0');
  payload.append('nap[rate_limit_cpu_usage_high]', '0');
  
  // Congestion Threshold
  payload.append('nap[congestion_threshold_nb_calls]', config.congestion_nb_calls || config.congestionNbCalls || '1');
  payload.append('nap[congestion_threshold_period_sec]', config.congestion_period || config.congestionPeriod || '1');
  payload.append('nap[congestion_threshold_period_sec_unit_conversion]', config.congestion_period_unit || config.congestionPeriodUnit || '1.0');
  
  // Submit button
  payload.append('commit', 'Create');
  
  return payload;
};

// Build complete NAP payload matching ProSBC form structure (legacy - for updates)
const buildFullNapPayload = (config, csrfToken) => {
  const payload = new URLSearchParams();
  
  // Form metadata
  payload.append('_method', 'put');
  payload.append('authenticity_token', csrfToken);
  
  // Basic NAP Configuration
  payload.append('nap[name]', config.name);
  payload.append('nap[enabled]', '0');
  payload.append('nap[enabled]', config.enabled !== false ? '1' : '0');
  payload.append('nap[profile_id]', config.profile_id || '1');
  payload.append('nap[get_stats_on_leg_termination]', 'true');
  
  // SIP Proxy Configuration
  const useProxy = Boolean(config.sip_destination_ip);
  payload.append('nap_sip_cfg[sip_use_proxy]', '0');
  payload.append('nap_sip_cfg[sip_use_proxy]', useProxy ? '1' : '0');
  
  if (useProxy) {
    payload.append('nap[sip_destination_ip]', config.sip_destination_ip || '');
    payload.append('nap[sip_destination_port]', config.sip_destination_port || '5060');
    payload.append('nap_sip_cfg[filter_by_remote_port]', '0');
    payload.append('nap_sip_cfg[filter_by_remote_port]', config.filter_by_proxy_port !== false ? '1' : '0');
    payload.append('nap_sip_cfg[poll_proxy]', '0');
    payload.append('nap_sip_cfg[poll_proxy]', config.poll_remote_proxy !== false ? '1' : '0');
    payload.append('nap_sip_cfg[proxy_polling_interval]', config.proxy_polling_interval || '1');
    payload.append('nap_sip_cfg[proxy_polling_interval_unit_conversion]', config.proxy_polling_interval_unit || '60000.0');
  }
  
  payload.append('nap_sip_cfg[accept_only_authorized_users]', '0');
  payload.append('nap_sip_cfg[accept_only_authorized_users]', config.accept_only_authorized_users ? '1' : '0');
  
  // Registration Parameters
  payload.append('nap_sip_cfg[register_to_proxy]', '0');
  payload.append('nap_sip_cfg[register_to_proxy]', config.register_to_proxy ? '1' : '0');
  payload.append('nap_sip_cfg[aor]', config.aor || '');
  
  // Authentication Parameters
  payload.append('nap[sip_auth_ignore_realm]', '0');
  payload.append('nap[sip_auth_ignore_realm]', config.sip_auth_ignore_realm ? '1' : '0');
  payload.append('nap[sip_auth_reuse_challenge]', '0');
  payload.append('nap[sip_auth_reuse_challenge]', config.sip_auth_reuse_challenge ? '1' : '0');
  payload.append('nap[sip_auth_realm]', config.sip_auth_realm || '');
  payload.append('nap[sip_auth_user]', config.sip_auth_user || '');
  payload.append('nap[sip_auth_pass]', config.sip_auth_pass || '');
  
  // NAT Parameters
  payload.append('nap_sip_cfg[remote_nat_traversal_method_id]', config.remote_nat_rtp || '0');
  payload.append('nap_sip_cfg[remote_sip_nat_traversal_method_id]', config.remote_nat_sip || '0');
  payload.append('nap_sip_cfg[nat_cfg_id]', config.local_nat_rtp || '');
  payload.append('nap_sip_cfg[nat_cfg_sip_id]', config.local_nat_sip || '');
  
  // SIP-I Parameters
  payload.append('nap_sip_cfg[sipi_enable]', '0');
  payload.append('nap_sip_cfg[sipi_enable]', config.sipi_enable ? '1' : '0');
  payload.append('nap_sip_cfg[sipi_isup_protocol_variant_id]', config.isup_protocol_variant || '5');
  payload.append('nap_sip_cfg[sipi_version]', config.sipi_version || 'itu-t');
  payload.append('nap_sip_cfg[sipi_use_info_progress]', config.sipi_use_info_progress || '0');
  payload.append('nap_tdm_cfg[append_trailing_f_to_number]', '0');
  payload.append('nap_tdm_cfg[append_trailing_f_to_number]', config.append_trailing_f ? '1' : '0');
  
  // Advanced Parameters
  payload.append('nap_sip_cfg[poll_proxy_ping_quirk]', '0');
  payload.append('nap_sip_cfg[poll_proxy_ping_quirk]', config.poll_proxy_ping_quirk !== false ? '1' : '0');
  payload.append('nap_sip_cfg[proxy_polling_response_timeout]', config.response_timeout || '12');
  payload.append('nap_sip_cfg[proxy_polling_response_timeout_unit_conversion]', config.response_timeout_unit || '1000.0');
  payload.append('nap_sip_cfg[proxy_polling_max_forwards]', config.max_forwards || '1');
  payload.append('nap_sip_cfg[sip_183_call_progress]', '0');
  payload.append('nap_sip_cfg[sip_183_call_progress]', config.sip_183_call_progress ? '1' : '0');
  payload.append('nap_sip_cfg[sip_privacy_type_id]', config.privacy_type || '3');
  
  // Call Rate Limiting
  payload.append('nap[rate_limit_cps]', config.rate_limit_cps || '0');
  payload.append('nap[rate_limit_cps_in]', config.rate_limit_cps_in || '0');
  payload.append('nap[rate_limit_cps_out]', config.rate_limit_cps_out || '0');
  payload.append('nap[max_incoming_calls]', config.max_incoming_calls || '0');
  payload.append('nap[max_outgoing_calls]', config.max_outgoing_calls || '0');
  payload.append('nap[max_incoming_outgoing_calls]', config.max_total_calls || '0');
  payload.append('nap[rate_limit_delay_low]', config.delay_low_threshold || '3');
  payload.append('nap[rate_limit_delay_low_unit_conversion]', config.delay_low_unit || '1.0');
  payload.append('nap[rate_limit_delay_high]', config.delay_high_threshold || '6');
  payload.append('nap[rate_limit_delay_high_unit_conversion]', config.delay_high_unit || '1.0');
  payload.append('nap[rate_limit_cpu_usage_low]', '0');
  payload.append('nap[rate_limit_cpu_usage_high]', '0');
  
  // Congestion Threshold
  payload.append('nap[congestion_threshold_nb_calls]', config.congestion_nb_calls || '1');
  payload.append('nap[congestion_threshold_period_sec]', config.congestion_period || '1');
  payload.append('nap[congestion_threshold_period_sec_unit_conversion]', config.congestion_period_unit || '1.0');
  
  // Configuration and commit
  payload.append('nap[configuration_id]', '1');
  payload.append('commit', 'Save');
  
  return payload;
};

// Check if NAP name already exists
export const checkNapExists = async (napName) => {
  const client = createApiClient();
  
  try {
    // Navigate to SIP section first
    await navigateToSipSection(client);
    
    // Try multiple NAP list URLs
    const napListUrls = [
      '/naps',
      '/configurations/1/sip/naps',
      '/sip/naps',
      '/sip_naps'
    ];
    
    let response = null;
    
    for (const url of napListUrls) {
      try {
        response = await client.get(url);
        const html = response.data;
        
        // Check if this response contains NAP-related content
        if (html.includes('nap') || html.includes('NAP') || html.includes('Network Access Point')) {
          break;
        }
      } catch (error) {
        console.log(`Failed to access ${url}: ${error.message}`);
      }
    }
    
    if (!response) {
      throw new Error('Could not access any NAP list pages in ProSBC');
    }
    
    const html = response.data;
    
    // Parse HTML to check for existing NAP names
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Look for NAP names in table rows
    const napLinks = doc.querySelectorAll('a.edit_link, a[href*="/naps/"][href*="/edit"]');
    
    for (const link of napLinks) {
      const existingName = link.textContent?.trim();
      if (existingName === napName) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    console.error('Error checking NAP existence:', error);
    // If we can't check, assume it doesn't exist to allow creation attempt
    return false;
  }
};

// Validate NAP configuration
export const validateNapConfig = (config) => {
  const errors = [];
  const warnings = [];
  
  // Required fields
  if (!config.name || config.name.trim().length === 0) {
    errors.push('NAP name is required');
  }
  
  if (config.name && config.name.length > 50) {
    warnings.push('NAP name is quite long and may be truncated in some displays');
  }
  
  // SIP Proxy validation
  if (config.sip_destination_ip) {
    // Basic IP validation
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    
    if (!ipPattern.test(config.sip_destination_ip) && !domainPattern.test(config.sip_destination_ip)) {
      errors.push('SIP destination IP must be a valid IP address or domain name');
    }
  }
  
  // Port validation
  if (config.sip_destination_port) {
    const port = parseInt(config.sip_destination_port);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('SIP destination port must be between 1 and 65535');
    }
  }
  
  // Authentication validation
  if (config.sip_auth_user && !config.sip_auth_pass) {
    warnings.push('Authentication user specified without password');
  }
  
  if (config.register_to_proxy && !config.aor) {
    warnings.push('Registration enabled but no Address of Record (AOR) specified');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

// Fallback NAP creation method using minimal approach
export const createBasicNap = async (napConfig) => {
  const client = createApiClient();
  
  try {
    console.log('Starting basic NAP creation fallback...');
    
    // Step 1: Get CSRF token
    const csrfToken = await getCsrfToken(client);
    
    // Step 2: Create NAP with minimal data
    const payload = new URLSearchParams();
    payload.append('authenticity_token', csrfToken);
    payload.append('nap[name]', napConfig.name);
    payload.append('nap[enabled]', '0');
    payload.append('nap[enabled]', napConfig.enabled !== false ? '1' : '0');
    payload.append('nap[profile_id]', napConfig.profile_id || '1');
    payload.append('nap[get_stats_on_leg_termination]', 'true');
    payload.append('nap[configuration_id]', '1');
    payload.append('commit', 'Create');
    
    console.log('Basic NAP payload:', Object.fromEntries(payload.entries()));
    
    const response = await client.request('/naps', {
      method: 'POST',
      body: payload.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    console.log('Basic NAP created successfully');

    return {
      success: true,
      message: `NAP "${napConfig.name}" created successfully (basic configuration)`,
      napId: null
    };
    
  } catch (error) {
    console.error('Basic NAP creation failed:', error);
    throw error;
  }
};

// Enhanced createNapWithProSBCWorkflow with fallback
const originalCreateNapWithProSBCWorkflow = createNapWithProSBCWorkflow;

export const createNapWithProSBCWorkflowEnhanced = async (napConfig) => {
  try {
    // Try the advanced workflow first
    return await originalCreateNapWithProSBCWorkflow(napConfig);
  } catch (error) {
    console.warn('Advanced NAP creation workflow failed, trying basic approach:', error.message);
    
    // Try the basic approach as fallback
    try {
      return await createBasicNap(napConfig);
    } catch (fallbackError) {
      console.error('Both advanced and basic NAP creation failed');
      
      return {
        success: false,
        message: `NAP creation failed: ${error.message}. Fallback also failed: ${fallbackError.message}`,
        napId: null
      };
    }
  }
};

// Export helper functions
export {
  createApiClient,
  getCsrfToken,
  extractNapIdFromRedirect,
  buildFullNapPayload,
  buildCompleteNapPayload
};
