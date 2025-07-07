// Optimized NAP API Client - ProSBC Workflow Implementation
// Performance optimizations:
// 1. Session reuse across operations
// 2. Cached CSRF tokens
// 3. Reduced redundant navigation calls
// 4. Parallel where possible

import axios from 'axios';
import { napPerformanceMonitor } from './performanceMonitor.js';
import { napAnalytics } from './napPerformanceAnalytics.js';

// Global session cache
let sessionCache = {
  isAuthenticated: false,
  csrfToken: null,
  tokenTimestamp: null,
  lastNavigation: null,
  client: null
};

// Token expires after 30 minutes
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;

// Get credentials from environment variables
const getCredentials = () => {
  const username = import.meta.env.VITE_PROSBC_USERNAME;
  const password = import.meta.env.VITE_PROSBC_PASSWORD;
  
  if (!username || !password) {
    throw new Error('ProSBC credentials not found. Please set VITE_PROSBC_USERNAME and VITE_PROSBC_PASSWORD in your .env file');
  }
  
  return { username, password };
};

// Create or reuse axios instance
const getApiClient = () => {
  if (sessionCache.client) {
    return sessionCache.client;
  }

  const credentials = getCredentials();
  
  const client = axios.create({
    baseURL: '/api',
    timeout: 60000, // Reduced from 120s to 60s
    withCredentials: true,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.7',
      'Cache-Control': 'no-cache'
    }
  });

  // Add authentication interceptor
  client.interceptors.request.use((config) => {
    const authString = btoa(`${credentials.username}:${credentials.password}`);
    config.headers.Authorization = `Basic ${authString}`;
    
    console.log(`NAP API Request: ${config.method?.toUpperCase()} ${config.url}`);
    
    return config;
  });

  // Add response interceptor for error handling
  client.interceptors.response.use(
    (response) => {
      console.log(`NAP API Response: ${response.status} ${response.statusText}`);
      return response;
    },
    (error) => {
      console.error('NAP API Error:', error.response?.status, error.response?.statusText);
      
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Clear session cache on auth failure
        sessionCache = {
          isAuthenticated: false,
          csrfToken: null,
          tokenTimestamp: null,
          lastNavigation: null,
          client: null
        };
        throw new Error('Authentication failed. Please check your ProSBC credentials.');
      }
      
      throw error;
    }
  );

  sessionCache.client = client;
  return client;
};

// Check if CSRF token is still valid
const isTokenValid = () => {
  if (!sessionCache.csrfToken || !sessionCache.tokenTimestamp) {
    return false;
  }
  
  const now = Date.now();
  return (now - sessionCache.tokenTimestamp) < TOKEN_EXPIRY_MS;
};

// Quick authentication check without full session establishment
const quickAuthCheck = async (client) => {
  try {
    const response = await client.get('/naps', {
      timeout: 10000, // Quick timeout for auth check
      headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
    
    // If we can access NAPs page, we're authenticated
    if (response.status === 200 && response.data.includes('nap')) {
      sessionCache.isAuthenticated = true;
      sessionCache.lastNavigation = '/naps';
      return true;
    }
  } catch (error) {
    console.log('Quick auth check failed:', error.message);
  }
  
  return false;
};

// Optimized session establishment
const establishSession = async () => {
  const client = getApiClient();
  
  // Skip if already authenticated and token is valid
  if (sessionCache.isAuthenticated && isTokenValid()) {
    console.log('✓ Using cached session and CSRF token');
    return { client, csrfToken: sessionCache.csrfToken };
  }
  
  console.log('Establishing ProSBC session...');
  
  // Try quick auth check first
  const quickAuthSuccess = await quickAuthCheck(client);
  if (quickAuthSuccess && isTokenValid()) {
    console.log('✓ Quick auth successful, using cached token');
    return { client, csrfToken: sessionCache.csrfToken };
  }
  
  try {
    // Full authentication flow
    const loginPageResponse = await client.get('/login', {
      headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
    
    // Check if already logged in
    if (loginPageResponse.data && !loginPageResponse.data.includes('login') && 
        loginPageResponse.data.includes('Configuration')) {
      console.log('✓ Already logged in to ProSBC');
      sessionCache.isAuthenticated = true;
      
      // Get CSRF token from any page with forms
      const csrfToken = await getCsrfTokenOptimized(client);
      return { client, csrfToken };
    }
    
    // Extract CSRF token and perform login
    const loginHtml = loginPageResponse.data;
    const csrfMatch = loginHtml.match(/name="authenticity_token"[^>]*value="([^"]+)"/i);
    
    if (csrfMatch && csrfMatch[1]) {
      const loginCsrfToken = csrfMatch[1];
      const credentials = getCredentials();
      
      const loginPayload = new URLSearchParams();
      loginPayload.append('authenticity_token', loginCsrfToken);
      loginPayload.append('user[name]', credentials.username);
      loginPayload.append('user[pass]', credentials.password);
      loginPayload.append('commit', 'Login');
      
      console.log('Performing ProSBC login...');
      
      const loginResponse = await client.post('/login/check', loginPayload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      if (loginResponse.data && loginResponse.data.includes('Configuration')) {
        console.log('✓ ProSBC session established successfully');
        sessionCache.isAuthenticated = true;
      }
    }
    
    // Get CSRF token
    const csrfToken = await getCsrfTokenOptimized(client);
    return { client, csrfToken };
    
  } catch (error) {
    console.warn('Session establishment failed:', error.message);
    console.log('Proceeding with Basic Auth only');
    
    // Still try to get CSRF token
    const csrfToken = await getCsrfTokenOptimized(client);
    return { client, csrfToken };
  }
};

// Optimized CSRF token extraction
const getCsrfTokenOptimized = async (client) => {
  // Return cached token if valid
  if (isTokenValid()) {
    console.log('✓ Using cached CSRF token');
    return sessionCache.csrfToken;
  }
  
  console.log('Fetching fresh CSRF token...');
  
  // Try to get token from current page or NAP pages
  const tokenUrls = ['/naps', '/naps/new'];
  
  for (const url of tokenUrls) {
    try {
      const response = await client.get(url, {
        timeout: 15000,
        headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
      });
      
      if (response.data) {
        const token = extractTokenFromHtml(response.data);
        if (token) {
          console.log(`✓ CSRF token extracted from ${url}`);
          sessionCache.csrfToken = token;
          sessionCache.tokenTimestamp = Date.now();
          return token;
        }
      }
    } catch (error) {
      console.log(`Failed to get token from ${url}: ${error.message}`);
    }
  }
  
  throw new Error('Could not extract CSRF token from any page');
};

// Extract token from HTML with validation
const extractTokenFromHtml = (html) => {
  const tokenPatterns = [
    /name="authenticity_token"[^>]*value="([^"]+)"/i,
    /<input[^>]*name="authenticity_token"[^>]*value="([^"]+)"[^>]*>/i,
    /<meta[^>]*name="csrf-token"[^>]*content="([^"]+)"[^>]*>/i
  ];
  
  for (const pattern of tokenPatterns) {
    const tokenMatch = html.match(pattern);
    if (tokenMatch && tokenMatch[1] && tokenMatch[1].length > 10) {
      const token = tokenMatch[1];
      
      // Validate token doesn't contain JavaScript
      if (!token.includes('encodeURIComponent') && 
          !token.includes('function') && 
          !token.includes('var') && 
          !token.includes('(') &&
          /^[a-zA-Z0-9+\/=_-]+$/.test(token)) {
        return token;
      }
    }
  }
  
  return null;
};

// Extract NAP ID from response
const extractNapIdFromResponse = (response, napName) => {
  try {
    // Check location header first
    const location = response.headers.location || response.headers.Location;
    if (location) {
      const match = location.match(/\/naps\/(\d+)/);
      if (match) {
        return match[1];
      }
    }
    
    // Check response data
    if (response.data && typeof response.data === 'string') {
      // Look for redirect or edit URL patterns
      const patterns = [
        /\/naps\/(\d+)\/edit/,
        /\/naps\/(\d+)/,
        new RegExp(`href="[^"]*\/naps\/(\\d+)\/edit"[^>]*>${napName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<`, 'i')
      ];
      
      for (const pattern of patterns) {
        const match = response.data.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }
  } catch (error) {
    console.error('Error extracting NAP ID:', error);
  }
  
  return null;
};

// Find newly created NAP by name
const findNapByName = async (client, napName) => {
  try {
    const response = await client.get('/naps', {
      timeout: 10000,
      headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
    
    if (response.data) {
      // Look for NAP with matching name using multiple patterns
      const escapedName = napName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Try different patterns for finding the NAP
      const patterns = [
        // Pattern 1: Standard edit link with NAP name
        new RegExp(`href="[^"]*\/naps\/(\\d+)\/edit"[^>]*>${escapedName}<`, 'i'),
        // Pattern 2: NAP name in table cell
        new RegExp(`<td[^>]*>${escapedName}<\/td>`, 'i'),
        // Pattern 3: NAP name followed by edit link
        new RegExp(`${escapedName}[^<]*<[^>]*href="[^"]*\/naps\/(\\d+)\/edit"`, 'i'),
        // Pattern 4: More flexible pattern
        new RegExp(`${escapedName}.*?\/naps\/(\\d+)\/edit`, 'i')
      ];
      
      for (const pattern of patterns) {
        const match = response.data.match(pattern);
        if (match) {
          // Find the NAP ID from the match
          const napIdMatch = match[0].match(/\/naps\/(\d+)\/edit/);
          if (napIdMatch) {
            console.log(`Found NAP "${napName}" with ID ${napIdMatch[1]}`);
            return napIdMatch[1];
          }
        }
      }
      
      // If no specific match found, check if the NAP name appears anywhere in the response
      if (response.data.includes(napName)) {
        console.log(`NAP name "${napName}" found in response, but could not extract ID`);
        // Try to find NAP ID near the name
        const napNameIndex = response.data.indexOf(napName);
        const contextBefore = response.data.substring(Math.max(0, napNameIndex - 200), napNameIndex);
        const contextAfter = response.data.substring(napNameIndex, napNameIndex + 200);
        
        const contextIdMatch = (contextBefore + contextAfter).match(/\/naps\/(\d+)\/edit/);
        if (contextIdMatch) {
          console.log(`Found NAP ID ${contextIdMatch[1]} near name "${napName}"`);
          return contextIdMatch[1];
        }
      }
    }
  } catch (error) {
    console.error('Error finding NAP by name:', error);
  }
  
  return null;
};

// Find newly created NAP by name (fallback with highest ID)
const findNapByNameWithFallback = async (client, napName) => {
  // First try exact name match
  const exactMatch = await findNapByName(client, napName);
  if (exactMatch) {
    return exactMatch;
  }
  
  // Fallback: get highest ID (only use for newly created NAPs)
  try {
    const response = await client.get('/naps', {
      timeout: 10000,
      headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
    
    if (response.data) {
      const allNapMatches = response.data.match(/\/naps\/(\d+)\/edit/g);
      if (allNapMatches && allNapMatches.length > 0) {
        // Get the highest ID (likely the newest)
        const ids = allNapMatches.map(match => parseInt(match.match(/\/naps\/(\d+)\/edit/)[1]));
        const highestId = Math.max(...ids).toString();
        console.log(`Using fallback: highest NAP ID ${highestId} for "${napName}"`);
        return highestId;
      }
    }
  } catch (error) {
    console.error('Error in fallback NAP search:', error);
  }
  
  return null;
};

// Optimized main NAP creation function
export const createNapWithProSBCWorkflowOptimized = async (napConfig) => {
  napPerformanceMonitor.startOperation('NAP Creation (Optimized)', {
    napName: napConfig.name,
    hasSipConfig: !!napConfig.sip_destination_ip,
    sipServersCount: napConfig.sip_servers?.length || 0,
    portRangesCount: napConfig.port_ranges?.length || 0
  });

  try {
    console.log('🚀 Creating NAP with optimized workflow...', napConfig);
    
    // Step 1: Establish session and get CSRF token (optimized)
    console.log('Step 1: Establishing session...');
    napPerformanceMonitor.addStep('Session establishment start');
    
    const { client, csrfToken } = await establishSession();
    
    if (!csrfToken) {
      throw new Error('Could not obtain CSRF token');
    }
    
    napPerformanceMonitor.addStep('Session established');
    console.log('✓ Session established with CSRF token');
    
    // Step 2: Create NAP with optimized payload
    console.log('Step 2: Creating NAP...');
    napPerformanceMonitor.addStep('NAP payload preparation');
    
    const payload = new URLSearchParams();
    payload.append('authenticity_token', csrfToken);
    payload.append('nap[name]', napConfig.name);
    payload.append('nap[enabled]', '0');
    payload.append('nap[enabled]', napConfig.enabled !== false ? '1' : '0');
    payload.append('nap[profile_id]', napConfig.profile_id || '1');
    payload.append('nap[get_stats_on_leg_termination]', 'true');
    
    // Add SIP configuration if provided
    if (napConfig.sip_destination_ip) {
      payload.append('nap_sip_cfg[sip_use_proxy]', '0');
      payload.append('nap_sip_cfg[sip_use_proxy]', '1');
      payload.append('nap[sip_destination_ip]', napConfig.sip_destination_ip);
      payload.append('nap[sip_destination_port]', napConfig.sip_destination_port || '5060');
      payload.append('nap_sip_cfg[filter_by_remote_port]', '0');
      payload.append('nap_sip_cfg[filter_by_remote_port]', '1');
      payload.append('nap_sip_cfg[poll_proxy]', '0');
      payload.append('nap_sip_cfg[poll_proxy]', '1');
      payload.append('nap_sip_cfg[proxy_polling_interval]', '1');
      payload.append('nap_sip_cfg[proxy_polling_interval_unit_conversion]', '60000.0');
    }
    
    // Rate limiting defaults
    payload.append('nap[rate_limit_cps]', napConfig.rate_limit_cps || '0');
    payload.append('nap[rate_limit_cps_in]', napConfig.rate_limit_cps_in || '0');
    payload.append('nap[rate_limit_cps_out]', napConfig.rate_limit_cps_out || '0');
    payload.append('nap[max_incoming_calls]', napConfig.max_incoming_calls || '0');
    payload.append('nap[max_outgoing_calls]', napConfig.max_outgoing_calls || '0');
    payload.append('nap[max_incoming_outgoing_calls]', napConfig.max_total_calls || '0');
    payload.append('nap[congestion_threshold_nb_calls]', '1');
    payload.append('nap[congestion_threshold_period_sec]', '1');
    payload.append('nap[congestion_threshold_period_sec_unit_conversion]', '60.0');
    payload.append('nap[configuration_id]', '1');
    payload.append('commit', 'Create');
    
    let napId = null;
    
    napPerformanceMonitor.addStep('NAP creation request');
    
    try {
      const createResponse = await client.post('/naps', payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      napId = extractNapIdFromResponse(createResponse, napConfig.name);
      napPerformanceMonitor.addStep('NAP created successfully');
      console.log('✓ NAP created successfully');
      
    } catch (createError) {
      // Handle expected CORS redirect
      if (createError.code === 'ERR_NETWORK' || 
          (createError.response && createError.response.status >= 300 && createError.response.status < 400)) {
        console.log('✓ NAP created (CORS redirect detected)');
        
        // Try to find the NAP ID
        napId = extractNapIdFromResponse(createError.response, napConfig.name);
        
        if (!napId) {
          // Wait a moment then search for the NAP (use fallback for newly created NAPs)
          await new Promise(resolve => setTimeout(resolve, 1000));
          napId = await findNapByNameWithFallback(client, napConfig.name);
        }
        
        napPerformanceMonitor.addStep('NAP ID resolved after CORS redirect');
      } else {
        throw createError;
      }
    }
    
    if (!napId) {
      throw new Error('NAP created but ID could not be determined');
    }
    
    console.log(`✓ NAP created with ID: ${napId}`);
    
    // Step 3: Add SIP servers and port ranges in parallel (if any)
    const additionalTasks = [];
    
    if (napConfig.sip_servers && napConfig.sip_servers.length > 0) {
      console.log('Step 3a: Adding SIP Transport Servers...');
      
      for (const serverId of napConfig.sip_servers) {
        const sipTask = async () => {
          const sipPayload = new URLSearchParams();
          sipPayload.append('authenticity_token', csrfToken);
          sipPayload.append('sip_sap[][sip_sap]', serverId);
          
          await client.post(`/nap/add_sip_sap/${napId}`, sipPayload.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
          
          console.log(`✓ SIP server ${serverId} added`);
        };
        
        additionalTasks.push(sipTask());
      }
    }
    
    if (napConfig.port_ranges && napConfig.port_ranges.length > 0) {
      console.log('Step 3b: Adding Port Ranges...');
      
      for (const rangeId of napConfig.port_ranges) {
        const portTask = async () => {
          const portPayload = new URLSearchParams();
          portPayload.append('authenticity_token', csrfToken);
          portPayload.append('port_range[][port_range]', rangeId);
          
          await client.post(`/nap/add_port_range/${napId}`, portPayload.toString(), {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
          
          console.log(`✓ Port range ${rangeId} added`);
        };
        
        additionalTasks.push(portTask());
      }
    }
    
    // Execute additional tasks in parallel
    if (additionalTasks.length > 0) {
      napPerformanceMonitor.addStep('Additional tasks execution start');
      await Promise.allSettled(additionalTasks);
      napPerformanceMonitor.addStep('Additional tasks completed');
    }
    
    const metric = napPerformanceMonitor.finishOperation(true, { napId });
    console.log(`🎉 NAP creation completed in ${metric.totalDuration}ms`);
    
    // Record session in analytics
    napAnalytics.recordSession({
      workflowType: 'optimized',
      napName: napConfig.name,
      napId: napId,
      success: true,
      totalDuration: metric.totalDuration,
      steps: metric.steps,
      details: {
        hasSipConfig: !!napConfig.sip_destination_ip,
        sipServersCount: napConfig.sip_servers?.length || 0,
        portRangesCount: napConfig.port_ranges?.length || 0
      }
    });
    
    return {
      success: true,
      message: `NAP "${napConfig.name}" created successfully`,
      napId: napId,
      editUrl: `/naps/${napId}/edit`,
      executionTime: metric.totalDuration,
      performanceSteps: metric.steps
    };
    
  } catch (error) {
    console.error('Optimized NAP creation failed:', error);
    const failedMetric = napPerformanceMonitor.finishOperation(false, { error: error.message });
    
    // Record failed session in analytics
    napAnalytics.recordSession({
      workflowType: 'optimized',
      napName: napConfig.name,
      napId: null,
      success: false,
      totalDuration: failedMetric?.totalDuration || 0,
      steps: failedMetric?.steps || [],
      error: error.message,
      details: {
        hasSipConfig: !!napConfig.sip_destination_ip,
        sipServersCount: napConfig.sip_servers?.length || 0,
        portRangesCount: napConfig.port_ranges?.length || 0
      }
    });
    
    return {
      success: false,
      message: error.message || 'Failed to create NAP',
      napId: null
    };
  }
};

// Function to check if NAP exists
export const checkNapExistsOptimized = async (napName) => {
  try {
    console.log(`Checking if NAP "${napName}" exists...`);
    const { client } = await establishSession();
    
    const response = await client.get('/naps', {
      timeout: 15000,
      headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
    
    if (response.data) {
      // First check if the NAP name appears anywhere in the response
      const nameExistsInResponse = response.data.includes(napName);
      console.log(`NAP name "${napName}" found in response: ${nameExistsInResponse}`);
      
      if (!nameExistsInResponse) {
        console.log(`✓ NAP "${napName}" does not exist`);
        return {
          exists: false,
          napId: null,
          message: `NAP "${napName}" does not exist`
        };
      }
      
      // If name exists, try to find the specific NAP ID
      const napId = await findNapByName(client, napName);
      
      if (napId) {
        console.log(`❌ NAP "${napName}" already exists with ID ${napId}`);
        return {
          exists: true,
          napId: napId,
          message: `NAP "${napName}" already exists with ID ${napId}`
        };
      } else {
        // Name appears but we can't find the ID - this might be a partial match
        console.log(`⚠️ NAP name "${napName}" appears in response but no exact match found`);
        
        // Let's check if it's a partial match by looking at the context
        const napNameIndex = response.data.indexOf(napName);
        const contextBefore = response.data.substring(Math.max(0, napNameIndex - 100), napNameIndex);
        const contextAfter = response.data.substring(napNameIndex, napNameIndex + 100);
        const context = contextBefore + contextAfter;
        
        // If the context contains table elements or NAP-specific HTML, it's likely a real NAP
        if (context.includes('<td>') || context.includes('edit') || context.includes('href')) {
          console.log(`❌ NAP "${napName}" appears to exist (found in NAP table context)`);
          return {
            exists: true,
            napId: 'unknown',
            message: `NAP "${napName}" appears to exist but ID could not be determined`
          };
        } else {
          console.log(`✓ NAP "${napName}" name appears but not in NAP context (likely safe to create)`);
          return {
            exists: false,
            napId: null,
            message: `NAP "${napName}" does not exist (name appears in unrelated context)`
          };
        }
      }
    } else {
      console.log('No response data received from /naps endpoint');
      return {
        exists: false,
        napId: null,
        message: 'Could not retrieve NAP list to check existence'
      };
    }
  } catch (error) {
    console.error('Error checking NAP existence:', error);
    return {
      exists: false,
      napId: null,
      message: `Error checking NAP: ${error.message}`
    };
  }
};

// Export the optimized version as the main function
export const createNapWithProSBCWorkflow = createNapWithProSBCWorkflowOptimized;
export const checkNapExists = checkNapExistsOptimized;

// Clear session cache manually if needed
export const clearSessionCache = () => {
  sessionCache = {
    isAuthenticated: false,
    csrfToken: null,
    tokenTimestamp: null,
    lastNavigation: null,
    client: null
  };
  console.log('Session cache cleared');
};

// Get performance metrics
export const getPerformanceMetrics = () => {
  return napPerformanceMonitor.getMetrics();
};

// Print performance summary
export const printPerformanceSummary = () => {
  napPerformanceMonitor.printSummary();
};

// Clear performance metrics
export const clearPerformanceMetrics = () => {
  napPerformanceMonitor.clearMetrics();
};

// Get performance analytics
export const getPerformanceAnalytics = () => {
  return napAnalytics.generateReport();
};

// Print performance analytics
export const printPerformanceAnalytics = () => {
  napAnalytics.printDetailedReport();
};

// Export performance data
export const exportPerformanceData = () => {
  return napAnalytics.exportData();
};

// Debug function to check NAP existence with detailed logging
export const debugNapExistence = async (napName) => {
  console.log(`🔍 Debug: Checking NAP existence for "${napName}"`);
  
  try {
    const { client } = await establishSession();
    
    const response = await client.get('/naps', {
      timeout: 15000,
      headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
    });
    
    if (response.data) {
      console.log(`📄 Response received, length: ${response.data.length} characters`);
      
      // Check if NAP name appears in response
      const nameIndex = response.data.indexOf(napName);
      console.log(`🔍 NAP name "${napName}" found at index: ${nameIndex}`);
      
      if (nameIndex !== -1) {
        // Show context around the found name
        const start = Math.max(0, nameIndex - 150);
        const end = Math.min(response.data.length, nameIndex + 150);
        const context = response.data.substring(start, end);
        console.log(`📝 Context around "${napName}":`);
        console.log(context);
        
        // Look for NAP pattern matches
        const escapedName = napName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const patterns = [
          new RegExp(`href="[^"]*\/naps\/(\\d+)\/edit"[^>]*>${escapedName}<`, 'i'),
          new RegExp(`<td[^>]*>${escapedName}<\/td>`, 'i'),
          new RegExp(`${escapedName}[^<]*<[^>]*href="[^"]*\/naps\/(\\d+)\/edit"`, 'i')
        ];
        
        patterns.forEach((pattern, index) => {
          const match = response.data.match(pattern);
          console.log(`🔍 Pattern ${index + 1} match:`, match ? match[0] : 'No match');
        });
      }
      
      // Show all NAP entries found
      const allNapMatches = response.data.match(/\/naps\/(\d+)\/edit/g);
      if (allNapMatches) {
        console.log(`📋 All NAP edit links found: ${allNapMatches.length}`);
        console.log(allNapMatches.slice(0, 10)); // Show first 10
      }
      
      // Try the actual function
      const result = await checkNapExistsOptimized(napName);
      console.log(`📊 Final result:`, result);
      
      return result;
    }
  } catch (error) {
    console.error('🚨 Debug error:', error);
    return { error: error.message };
  }
};
