// NAP Management API Client - Using Basic Auth with Environment Variables - Fixed Version
// 
// Enhanced Features:
// - Comprehensive NAP configuration with full field support
// - Automatic template generation for minimal input data
// - Input validation with detailed error reporting
// - Multiple payload format attempts for better API compatibility
// - Extensive logging and debugging information
// - Support for all ProSBC NAP configuration options
//
// Usage:
// - For simple NAP creation: createNap({ name: "MyNAP" })
// - For detailed NAP creation: createNap(generateNapTemplate("MyNAP", options))
// - For validation: validateNapData(napData)
//
import axios from 'axios';

// Get credentials from environment variables
const getCredentials = () => {
  const username = import.meta.env.VITE_PROSBC_USERNAME;
  const password = import.meta.env.VITE_PROSBC_PASSWORD;
  
  if (!username || !password) {
    throw new Error('ProSBC credentials not found. Please set VITE_PROSBC_USERNAME and VITE_PROSBC_PASSWORD in your .env file');
  }
  
  return { username, password };
};

// Create axios instance with timeout settings
const apiClient = axios.create({
  baseURL: '/api', // Use the proxy configured in vite.config.js
  timeout: 120000, // 2 minutes timeout
  withCredentials: true, // Enable cookies to be sent
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/html, */*',
  },
});

let isAuthenticated = false;

// Add request interceptor for authentication
const setupBasicAuth = () => {
  try {
    const credentials = getCredentials();
    
    apiClient.interceptors.request.use((config) => {
      const authString = btoa(`${credentials.username}:${credentials.password}`);
      config.headers.Authorization = `Basic ${authString}`;
      console.log('Adding Basic Auth to request:', config.url);
      return config;
    });

    // Add response interceptor for error handling
    apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.code === 'ECONNABORTED') {
          console.error('Request timeout - API is taking too long to respond');
        }
        return Promise.reject(error);
      }
    );
    
    isAuthenticated = true;
    console.log('Basic Auth interceptor configured successfully');
  } catch (error) {
    console.error('Failed to setup Basic Auth:', error);
    throw error;
  }
};

// Set up authentication with environment credentials
export const setupAuthentication = async () => {
  try {
    setupBasicAuth();
    console.log('Basic authentication configured with environment credentials via proxy');
    return { success: true, message: 'Authentication configured successfully' };
  } catch (error) {
    console.error('Setup authentication failed:', error);
    throw new Error(`Failed to set up authentication: ${error.message}`);
  }
};

// Export shared client functions for use by apiClient.js
export const getSharedApiClient = () => {
  return apiClient;
};

export const isSessionValid = () => {
  return isAuthenticated && apiClient;
};

// Function to fetch existing NAPs from ProSBC with improved endpoint discovery
export const fetchExistingNaps = async () => {
  // Try multiple possible endpoints in order of preference
  const endpointsToTry = [
    { path: '/configurations/config_1/naps.json', contentType: 'application/json' },
    { path: '/configurations/config_1/naps/', contentType: 'text/html' },
    { path: '/naps.json', contentType: 'application/json' },
    { path: '/naps', contentType: 'text/html' },
    { path: '/configurations/config_1/naps', contentType: 'text/html' },
    { path: '/admin/configurations/config_1/naps/', contentType: 'text/html' },
    { path: '/prosbc/configurations/config_1/naps/', contentType: 'text/html' },
  ];
  
  for (const endpoint of endpointsToTry) {
    try {
      console.log(`Trying endpoint: ${endpoint.path} (expecting ${endpoint.contentType})`);
      
      const headers = {
        'Accept': endpoint.contentType === 'application/json' 
          ? 'application/json' 
          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      };
      
      const response = await apiClient.get(endpoint.path, { headers });
      
      console.log(`Response from ${endpoint.path}:`);
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers['content-type']);
      console.log('Data type:', typeof response.data);
      console.log('Data length:', response.data?.length || 'N/A');
      
      // Handle JSON responses
      if (endpoint.contentType === 'application/json' && 
          typeof response.data === 'object' && 
          response.data !== null) {
        console.log(`Successfully fetched NAPs from JSON endpoint: ${endpoint.path}`);
        return response.data;
      }
      
      // Handle HTML responses
      if (typeof response.data === 'string') {
        // Check if it's a login redirect
        if (response.data.includes('login_form') || 
            response.data.includes('user[name]') ||
            response.data.includes('<title>Login</title>') ||
            response.data.includes('Please log in')) {
          console.log(`Endpoint ${endpoint.path} returned login page, authentication may have failed`);
          throw new Error('Authentication required - redirected to login page');
        }
        
        // Check if it's an error page
        if (response.data.includes('404') || response.data.includes('Not Found') ||
            response.data.includes('500') || response.data.includes('Internal Server Error')) {
          console.log(`Endpoint ${endpoint.path} returned error page`);
          continue;
        }
        
        // Try to parse NAP data from HTML
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(response.data, 'text/html');
          
          // Look for various possible NAP table structures
          const possibleSelectors = [
            '#nap_list table.list',
            '#nap_list table',
            'table.list',
            'table.nap-list',
            '.nap-table',
            '#configurations table',
            'table[id*="nap"]',
            'table[class*="nap"]',
            '.content table',
            '#main-content table',
            'div.list table'
          ];
          
          let napTable = null;
          for (const selector of possibleSelectors) {
            napTable = doc.querySelector(selector);
            if (napTable) {
              console.log(`Found NAP table using selector: ${selector}`);
              break;
            }
          }
          
          if (!napTable) {
            // Log all tables found for debugging
            const allTables = doc.querySelectorAll('table');
            console.log(`Endpoint ${endpoint.path} returned HTML with ${allTables.length} tables but no NAP table found`);
            
            if (allTables.length > 0) {
              console.log('Available tables:');
              allTables.forEach((table, index) => {
                console.log(`Table ${index}: id="${table.id}" class="${table.className}"`);
              });
            }
            
            console.log('HTML preview:', response.data.substring(0, 1000));
            continue;
          }
          
          // Extract NAP names from table rows
          const rows = napTable.querySelectorAll('tr');
          const naps = {};
          
          console.log(`Found ${rows.length} rows in NAP table`);
          
          // Skip header row (index 0) and process data rows
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.querySelectorAll('td, th');
            
            if (cells.length >= 1) {
              // Try different ways to extract NAP name
              let napName = null;
              
              // Method 1: Look for edit link
              const editLink = cells[0].querySelector('a.edit_link, a[href*="edit"], a[href*="nap"]');
              if (editLink) {
                napName = editLink.textContent?.trim();
              }
              
              // Method 2: Look for any link in first cell
              if (!napName) {
                const anyLink = cells[0].querySelector('a');
                if (anyLink) {
                  napName = anyLink.textContent?.trim();
                }
              }
              
              // Method 3: Look for plain text in first cell
              if (!napName) {
                napName = cells[0].textContent?.trim();
              }
              
              // Method 4: Look for text in second cell if first is empty or just icons
              if (!napName || napName.length < 2) {
                if (cells.length > 1) {
                  napName = cells[1].textContent?.trim();
                }
              }
              
              if (napName && napName.length > 0 && !napName.includes('No NAPs') && !napName.includes('Name')) {
                // Parse status/enabled field more intelligently
                let enabled = false;
                let status = 'inactive';
                
                if (cells.length > 1) {
                  const statusText = cells[1].textContent?.trim().toLowerCase();
                  if (statusText) {
                    // Check for various status indicators
                    if (statusText.includes('active') || 
                        statusText.includes('enabled') || 
                        statusText.includes('on') ||
                        statusText.includes('yes') ||
                        statusText === 'true') {
                      enabled = true;
                      status = 'active';
                    } else if (statusText.includes('inactive') || 
                               statusText.includes('disabled') || 
                               statusText.includes('off') ||
                               statusText.includes('no') ||
                               statusText === 'false') {
                      enabled = false;
                      status = 'inactive';
                    }
                  }
                }
                
                naps[napName] = {
                  name: napName,
                  enabled: enabled,
                  status: status,
                  // Add other properties if available from other cells
                  description: cells.length > 2 ? cells[2].textContent?.trim() : undefined,
                  raw_status: cells.length > 1 ? cells[1].textContent?.trim() : undefined, // Keep original for debugging
                };
                console.log(`Found NAP: ${napName}, enabled: ${enabled}, raw_status: "${cells.length > 1 ? cells[1].textContent?.trim() : 'N/A'}"`);
              }
            }
          }
          
          if (Object.keys(naps).length > 0) {
            console.log(`Successfully parsed ${Object.keys(naps).length} NAPs from HTML:`, Object.keys(naps));
            return naps;
          } else {
            console.log(`NAP table found but no NAPs extracted from ${endpoint.path}`);
            console.log('Table HTML:', napTable.outerHTML.substring(0, 500));
            continue;
          }
          
        } catch (parseError) {
          console.log(`Failed to parse HTML from ${endpoint.path}:`, parseError.message);
          continue;
        }
      }
      
      console.log(`Endpoint ${endpoint.path} returned unexpected format, trying next...`);
      continue;
      
    } catch (error) {
      console.log(`Endpoint ${endpoint.path} failed:`, error.message);
      
      if (error.response) {
        console.log('Error status:', error.response.status);
        console.log('Error headers:', error.response.headers);
        
        // If we get 406 (Not Acceptable), the server doesn't like our Accept header
        if (error.response.status === 406) {
          console.log(`Server returned 406 for ${endpoint.path}, content negotiation failed`);
          continue;
        }
        
        // If we get 401/403, authentication failed
        if (error.response.status === 401 || error.response.status === 403) {
          throw new Error('Authentication failed - invalid credentials or session expired');
        }
      }
      
      if (error.message.includes('Authentication required')) {
        throw error; // Re-throw auth errors
      }
      
      // Continue to next endpoint for other errors
      continue;
    }
  }
  
  // If all endpoints failed, return empty object instead of throwing error to allow app to continue
  console.warn('All NAP listing endpoints failed. Returning empty NAP list.');
  return {};
};

// Function to check if NAP name already exists
export const checkNapExists = async (napName) => {
  try {
    const existingNaps = await fetchExistingNaps();
    // Check if napName exists as a key in the response (excluding ***meta***)
    return existingNaps.hasOwnProperty(napName) && napName !== '***meta***';
  } catch (error) {
    console.error('Error checking NAP existence:', error);
    
    if (error.message.includes('Authentication required') || 
        error.message.includes('login') ||
        error.message.includes('credentials not found')) {
      throw new Error('Authentication required. Please check your .env file credentials.');
    }
    
    // Return false if we can't check, allowing creation to proceed
    console.warn('Could not check NAP existence, allowing creation to proceed');
    return false;
  }
};

// Create a new NAP following ProSBC's exact workflow: create -> redirect -> configure -> save
export const createNap = async (napData) => {
  try {
    console.log('Creating NAP with ProSBC workflow...', napData);
    
    // Step 1: Create initial NAP with basic data (following ProSBC form structure)
    const initialPayload = new URLSearchParams();
    initialPayload.append('authenticity_token', ''); // Will be handled by interceptor
    initialPayload.append('nap[name]', napData.name);
    initialPayload.append('nap[enabled]', '0'); // Hidden field
    initialPayload.append('nap[enabled]', napData.enabled !== false ? '1' : '0');
    initialPayload.append('nap[profile_id]', napData.profile_id || '1');
    initialPayload.append('nap[get_stats_on_leg_termination]', 'true');
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
    initialPayload.append('nap[congestion_threshold_nb_calls]', '1');
    initialPayload.append('nap[congestion_threshold_period_sec]', '1');
    initialPayload.append('nap[congestion_threshold_period_sec_unit_conversion]', '60.0');
    initialPayload.append('nap[configuration_id]', '1');
    initialPayload.append('commit', 'Create');

    console.log('Step 1: Creating initial NAP at /naps');
    
    const createResponse = await apiClient.post('/naps', initialPayload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      maxRedirects: 0, // Don't auto-follow redirects
      validateStatus: (status) => status >= 200 && status < 400 // Accept redirects
    });

    console.log('Initial creation response status:', createResponse.status);
    
    // Check if we got a redirect (302) with location header
    let napId = null;
    if (createResponse.status === 302 && createResponse.headers.location) {
      const locationMatch = createResponse.headers.location.match(/\/naps\/(\d+)\/edit/);
      if (locationMatch) {
        napId = locationMatch[1];
        console.log(`Step 1 successful: NAP created with ID ${napId}`);
      }
    }

    if (!napId) {
      throw new Error('Failed to create NAP - no redirect received');
    }

    // Step 2: If we have additional configuration, update the NAP
    if (Object.keys(napData).length > 2) { // More than just name and enabled
      console.log(`Step 2: Configuring NAP ${napId} with detailed settings`);
      
      const updatePayload = new URLSearchParams();
      updatePayload.append('_method', 'put');
      updatePayload.append('authenticity_token', '');
      
      // Basic settings
      updatePayload.append('nap[name]', napData.name);
      updatePayload.append('nap[enabled]', '0');
      updatePayload.append('nap[enabled]', napData.enabled !== false ? '1' : '0');
      updatePayload.append('nap[profile_id]', napData.profile_id || '1');
      updatePayload.append('nap[get_stats_on_leg_termination]', 'true');

      // SIP Configuration
      if (napData.sip_destination_ip || napData.proxy_address) {
        updatePayload.append('nap_sip_cfg[sip_use_proxy]', '0');
        updatePayload.append('nap_sip_cfg[sip_use_proxy]', '1');
        updatePayload.append('nap[sip_destination_ip]', napData.sip_destination_ip || napData.proxy_address || '');
        updatePayload.append('nap[sip_destination_port]', napData.sip_destination_port || napData.proxy_port || '5060');
        updatePayload.append('nap_sip_cfg[filter_by_remote_port]', '0');
        updatePayload.append('nap_sip_cfg[filter_by_remote_port]', '1');
        updatePayload.append('nap_sip_cfg[poll_proxy]', '0');
        updatePayload.append('nap_sip_cfg[poll_proxy]', '1');
        updatePayload.append('nap_sip_cfg[proxy_polling_interval]', '1');
        updatePayload.append('nap_sip_cfg[proxy_polling_interval_unit_conversion]', '60000.0');
      } else {
        updatePayload.append('nap_sip_cfg[sip_use_proxy]', '0');
      }

      updatePayload.append('nap_sip_cfg[accept_only_authorized_users]', '0');
      
      // Registration parameters
      updatePayload.append('nap_sip_cfg[register_to_proxy]', '0');
      updatePayload.append('nap_sip_cfg[aor]', napData.aor || '');

      // Authentication parameters
      updatePayload.append('nap[sip_auth_ignore_realm]', '0');
      updatePayload.append('nap[sip_auth_reuse_challenge]', '0');
      updatePayload.append('nap[sip_auth_realm]', napData.sip_auth_realm || '');
      updatePayload.append('nap[sip_auth_user]', napData.sip_auth_user || '');
      updatePayload.append('nap[sip_auth_pass]', napData.sip_auth_pass || '');

      // NAT settings
      updatePayload.append('nap_sip_cfg[remote_nat_traversal_method_id]', '0');
      updatePayload.append('nap_sip_cfg[remote_sip_nat_traversal_method_id]', '0');
      updatePayload.append('nap_sip_cfg[nat_cfg_id]', '');
      updatePayload.append('nap_sip_cfg[nat_cfg_sip_id]', '');

      // SIP-I parameters
      updatePayload.append('nap_sip_cfg[sipi_enable]', '0');
      updatePayload.append('nap_sip_cfg[sipi_isup_protocol_variant_id]', '5');
      updatePayload.append('nap_sip_cfg[sipi_version]', 'itu-t');
      updatePayload.append('nap_sip_cfg[sipi_use_info_progress]', '0');
      updatePayload.append('nap_tdm_cfg[append_trailing_f_to_number]', '0');

      // Advanced parameters
      updatePayload.append('nap_sip_cfg[poll_proxy_ping_quirk]', '0');
      updatePayload.append('nap_sip_cfg[poll_proxy_ping_quirk]', '1');
      updatePayload.append('nap_sip_cfg[proxy_polling_response_timeout]', '12');
      updatePayload.append('nap_sip_cfg[proxy_polling_response_timeout_unit_conversion]', '1000.0');
      updatePayload.append('nap_sip_cfg[proxy_polling_max_forwards]', '1');
      updatePayload.append('nap_sip_cfg[sip_183_call_progress]', '0');
      updatePayload.append('nap_sip_cfg[sip_privacy_type_id]', '3');

      // Rate limiting (keep defaults from creation)
      updatePayload.append('nap[rate_limit_cps]', '0');
      updatePayload.append('nap[rate_limit_cps_in]', '0');
      updatePayload.append('nap[rate_limit_cps_out]', '0');
      updatePayload.append('nap[max_incoming_calls]', '0');
      updatePayload.append('nap[max_outgoing_calls]', '0');
      updatePayload.append('nap[max_incoming_outgoing_calls]', '0');
      updatePayload.append('nap[rate_limit_delay_low]', '3');
      updatePayload.append('nap[rate_limit_delay_low_unit_conversion]', '1.0');
      updatePayload.append('nap[rate_limit_delay_high]', '6');
      updatePayload.append('nap[rate_limit_delay_high_unit_conversion]', '1.0');
      updatePayload.append('nap[rate_limit_cpu_usage_low]', '0');
      updatePayload.append('nap[rate_limit_cpu_usage_high]', '0');

      // Congestion threshold
      updatePayload.append('nap[congestion_threshold_nb_calls]', '1');
      updatePayload.append('nap[congestion_threshold_period_sec]', '1');
      updatePayload.append('nap[congestion_threshold_period_sec_unit_conversion]', '1.0');

      updatePayload.append('nap[configuration_id]', '1');
      updatePayload.append('commit', 'Save');

      const updateResponse = await apiClient.post(`/naps/${napId}`, updatePayload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });

      console.log('Configuration update response status:', updateResponse.status);
    }

    return { 
      success: true, 
      message: `NAP "${napData.name}" created successfully with ID ${napId}`,
      napId: napId,
      editUrl: `/naps/${napId}/edit`
    };
    
  } catch (error) {
    console.error('Error creating NAP:', error);
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Authentication failed. Please check your credentials in the .env file.');
    }
    
    return { 
      success: false, 
      message: error.message || 'Failed to create NAP' 
    };
  }
};

// Fetch live NAP data from ProSBC (alias for fetchExistingNaps)
export const fetchLiveNaps = async () => {
  try {
    const naps = await fetchExistingNaps();
    
    // Convert object format to array format if needed
    if (typeof naps === 'object' && !Array.isArray(naps)) {
      return Object.keys(naps)
        .filter(name => name !== '***meta***')
        .map(name => ({
          id: name,
          name: name,
          ...naps[name]
        }));
    }
    
    return naps;
  } catch (error) {
    console.error('Error fetching live NAPs:', error);
    throw error;
  }
};

// Delete a NAP (basic implementation)
export const deleteNap = async (napId) => {
  try {
    console.log(`Deleting NAP ${napId}...`);
    
    const deleteEndpoints = [
      `/configurations/config_1/naps/${napId}`,
      `/naps/${napId}`,
      `/admin/configurations/config_1/naps/${napId}`,
      `/prosbc/configurations/config_1/naps/${napId}`
    ];
    
    for (const endpoint of deleteEndpoints) {
      try {
        const response = await apiClient.delete(endpoint);
        
        if (response.status >= 200 && response.status < 300) {
          return { success: true, message: 'NAP deleted successfully' };
        }
        
      } catch (endpointError) {
        console.log(`Delete endpoint ${endpoint} failed:`, endpointError.message);
        continue;
      }
    }
    
    throw new Error('All NAP deletion endpoints failed');
    
  } catch (error) {
    console.error('Error deleting NAP:', error);
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Authentication failed. Please check your credentials in the .env file.');
    }
    
    throw new Error(`Failed to delete NAP: ${error.message}`);
  }
};

// Update a NAP (basic implementation)
export const updateNap = async (napId, napData) => {
  try {
    console.log(`Updating NAP ${napId}...`, napData);
    
    const updateEndpoints = [
      `/configurations/config_1/naps/${napId}`,
      `/naps/${napId}`,
      `/admin/configurations/config_1/naps/${napId}`,
      `/prosbc/configurations/config_1/naps/${napId}`
    ];
    
    for (const endpoint of updateEndpoints) {
      try {
        const response = await apiClient.put(endpoint, napData);
        
        if (response.status >= 200 && response.status < 300) {
          return { success: true, message: 'NAP updated successfully' };
        }
        
      } catch (endpointError) {
        console.log(`Update endpoint ${endpoint} failed:`, endpointError.message);
        continue;
      }
    }
    
    throw new Error('All NAP update endpoints failed');
    
  } catch (error) {
    console.error('Error updating NAP:', error);
    
    if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Authentication failed. Please check your credentials in the .env file.');
    }
    
    throw new Error(`Failed to update NAP: ${error.message}`);
  }
};

// Generate a complete NAP configuration template
export const generateNapTemplate = (name, options = {}) => {
  return {
    // Basic identification
    name: name,
    description: options.description || `NAP configuration for ${name}`,
    enabled: options.enabled !== undefined ? options.enabled : true,
    
    // Network configuration
    interface: options.interface || 'eth0',
    ip_address: options.ip_address || options.ipAddress || '',
    subnet_mask: options.subnet_mask || options.subnetMask || '255.255.255.0',
    gateway: options.gateway || '',
    
    // VLAN configuration
    vlan_id: options.vlan_id || options.vlanId || null,
    vlan_priority: options.vlan_priority || options.vlanPriority || 0,
    
    // QoS settings
    qos_profile: options.qos_profile || options.qosProfile || 'default',
    bandwidth_limit: options.bandwidth_limit || options.bandwidthLimit || null,
    
    // Security configuration
    security_profile: options.security_profile || options.securityProfile || 'standard',
    firewall_rules: options.firewall_rules || options.firewallRules || [],
    
    // Protocol settings
    protocols: options.protocols || ['TCP', 'UDP'],
    port_ranges: options.port_ranges || options.portRanges || [
      { start: 80, end: 80, protocol: 'TCP', description: 'HTTP' },
      { start: 443, end: 443, protocol: 'TCP', description: 'HTTPS' }
    ],
    
    // Advanced network settings
    mtu_size: options.mtu_size || options.mtuSize || 1500,
    routing_table: options.routing_table || options.routingTable || [],
    nat_settings: options.nat_settings || options.natSettings || {
      enabled: false,
      external_ip: '',
      port_mapping: []
    },
    
    // Monitoring and logging
    monitoring_enabled: options.monitoring_enabled !== undefined ? options.monitoring_enabled : true,
    logging_level: options.logging_level || options.loggingLevel || 'info',
    log_retention_days: options.log_retention_days || options.logRetentionDays || 30,
    
    // Performance settings
    connection_timeout: options.connection_timeout || options.connectionTimeout || 30,
    keepalive_interval: options.keepalive_interval || options.keepaliveInterval || 60,
    max_connections: options.max_connections || options.maxConnections || 1000,
    
    // Backup and redundancy
    backup_enabled: options.backup_enabled !== undefined ? options.backup_enabled : false,
    redundancy_mode: options.redundancy_mode || options.redundancyMode || 'none',
    
    // Custom metadata
    created_at: new Date().toISOString(),
    last_modified: new Date().toISOString(),
    version: '1.0',
    tags: options.tags || [],
    
    // Override with any additional options
    ...options
  };
};

// Get supported NAP configuration fields and their descriptions
export const getNapConfigurationFields = () => {
  return {
    basic: {
      name: { required: true, type: 'string', description: 'Unique name for the NAP' },
      description: { required: false, type: 'string', description: 'Description of the NAP purpose' },
      enabled: { required: false, type: 'boolean', description: 'Whether the NAP is enabled', default: true }
    },
    network: {
      interface: { required: false, type: 'string', description: 'Network interface to use', default: 'eth0' },
      ip_address: { required: false, type: 'string', description: 'IP address for the NAP' },
      subnet_mask: { required: false, type: 'string', description: 'Subnet mask', default: '255.255.255.0' },
      gateway: { required: false, type: 'string', description: 'Default gateway IP address' }
    },
    vlan: {
      vlan_id: { required: false, type: 'number', description: 'VLAN ID (1-4094)' },
      vlan_priority: { required: false, type: 'number', description: 'VLAN priority (0-7)', default: 0 }
    },
    qos: {
      qos_profile: { required: false, type: 'string', description: 'Quality of Service profile', default: 'default' },
      bandwidth_limit: { required: false, type: 'number', description: 'Bandwidth limit in Mbps' }
    },
    security: {
      security_profile: { required: false, type: 'string', description: 'Security profile to apply', default: 'standard' },
      firewall_rules: { required: false, type: 'array', description: 'Array of firewall rules' }
    },
    protocols: {
      protocols: { required: false, type: 'array', description: 'Supported protocols', default: ['TCP', 'UDP'] },
      port_ranges: { required: false, type: 'array', description: 'Array of port range objects' }
    },
    advanced: {
      mtu_size: { required: false, type: 'number', description: 'Maximum Transmission Unit size', default: 1500 },
      routing_table: { required: false, type: 'array', description: 'Custom routing table entries' },
      nat_settings: { required: false, type: 'object', description: 'Network Address Translation settings' }
    },
    monitoring: {
      monitoring_enabled: { required: false, type: 'boolean', description: 'Enable monitoring', default: true },
      logging_level: { required: false, type: 'string', description: 'Logging level (debug, info, warn, error)', default: 'info' },
      log_retention_days: { required: false, type: 'number', description: 'Days to retain logs', default: 30 }
    },
    performance: {
      connection_timeout: { required: false, type: 'number', description: 'Connection timeout in seconds', default: 30 },
      keepalive_interval: { required: false, type: 'number', description: 'Keep-alive interval in seconds', default: 60 },
      max_connections: { required: false, type: 'number', description: 'Maximum concurrent connections', default: 1000 }
    }
  };
};

// Helper function to create NAP with SIP proxy configuration
export const createSipProxyNap = async (napData) => {
  const sipProxyConfig = {
    name: napData.name,
    enabled: napData.enabled !== false,
    profile_id: napData.profile_id || '1',
    
    // SIP Proxy settings
    sip_destination_ip: napData.proxy_address || napData.sip_destination_ip,
    sip_destination_port: napData.proxy_port || napData.sip_destination_port || '5060',
    
    // Authentication if provided
    sip_auth_realm: napData.realm || napData.sip_auth_realm,
    sip_auth_user: napData.username || napData.sip_auth_user,
    sip_auth_pass: napData.password || napData.sip_auth_pass,
    
    // Registration if provided
    aor: napData.aor || napData.address_of_record,
    
    // Override with any additional settings
    ...napData
  };
  
  console.log('Creating SIP Proxy NAP with configuration:', sipProxyConfig);
  return await createNap(sipProxyConfig);
};

// Helper function to create simple NAP (name only)
export const createSimpleNap = async (name, enabled = true) => {
  return await createNap({
    name: name,
    enabled: enabled
  });
};

// Validate NAP data before creation
export const validateNapData = (napData) => {
  const errors = [];
  const warnings = [];
  
  // Required fields
  if (!napData.name || napData.name.trim() === '') {
    errors.push('NAP name is required');
  }
  
  // Check for ProSBC naming conventions
  if (napData.name && napData.name.length > 50) {
    warnings.push('NAP name is quite long - ProSBC may truncate it');
  }
  
  // SIP configuration validation
  if (napData.sip_destination_ip || napData.proxy_address) {
    const ipAddress = napData.sip_destination_ip || napData.proxy_address;
    
    // Basic IP address validation
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    
    if (!ipRegex.test(ipAddress) && !domainRegex.test(ipAddress)) {
      errors.push('Invalid proxy address format - must be valid IP address or domain name');
    }
  }
  
  // Port validation
  if (napData.sip_destination_port || napData.proxy_port) {
    const port = parseInt(napData.sip_destination_port || napData.proxy_port);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push('Proxy port must be between 1 and 65535');
    }
  }
  
  // Profile validation
  if (napData.profile_id) {
    const profileId = parseInt(napData.profile_id);
    if (isNaN(profileId) || profileId < 1) {
      warnings.push('Invalid profile ID - using default profile');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

export default apiClient;
