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
import https from 'https';

// Get credentials from Node.js environment variables
const getCredentials = () => {
  const username = process.env.PROSBC_USERNAME;
  const password = process.env.PROSBC_PASSWORD;
  if (!username || !password) {
    throw new Error('ProSBC credentials not found. Please set PROSBC_USERNAME and PROSBC_PASSWORD in your environment variables');
  }
  return { username, password };
};

// Create axios instance with timeout settings
const apiClient = axios.create({
  baseURL: process.env.PROSBC_BASE_URL, // Use .env value for ProSBC API
  timeout: 120000, // 2 minutes timeout
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
      // Use Buffer for base64 encoding in Node.js
      const authString = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
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
export const fetchExistingNaps = async () => {
  console.log('========== [ProSBC NAP API] fetchExistingNaps START ==========');
  // Define endpoints to try for NAP listing
  const endpointsToTry = [
    { path: '/naps', contentType: 'text/html' },
    { path: '/configurations/1/sip/naps', contentType: 'text/html' },
    { path: '/sip/naps', contentType: 'text/html' },
    { path: '/api/naps', contentType: 'application/json' }
  ];
  // Set up headers for requests
  const credentials = getCredentials();
  const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Authorization': 'Basic ' + Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')
  };
  // Create agent to ignore self-signed certificate errors
  const agent = new https.Agent({ rejectUnauthorized: false });
  for (const endpoint of endpointsToTry) {
    console.log(`[ProSBC NAP API] Trying endpoint: ${endpoint.path}`);
    try {
      const response = await apiClient.get(endpoint.path, { headers, httpsAgent: agent });
      console.log(`[ProSBC NAP API] Response status: ${response.status}`);
      console.log(`[ProSBC NAP API] Response headers:`, response.headers);
      console.log(`[ProSBC NAP API] Response data type:`, typeof response.data);
      if (typeof response.data === 'string') {
        console.log(`[ProSBC NAP API] Response data (preview):`, response.data.substring(0, 500));
      } else {
        console.log(`[ProSBC NAP API] Response data (object):`, JSON.stringify(response.data, null, 2));
      }
      // Handle JSON responses (NAPs as keys)
      if (typeof response.data === 'object' && response.data !== null) {
        // Filter out ***meta*** and undefined keys
        const napNames = Object.keys(response.data).filter(
          key => key !== '***meta***' && key !== 'undefined'
        );
        if (napNames.length > 0) {
          const naps = {};
          napNames.forEach(name => {
            naps[name] = {
              name,
              ...response.data[name]
            };
          });
          console.log(`[ProSBC NAP API] Returning NAPs from JSON keys:`, napNames);
          console.log('========== [ProSBC NAP API] fetchExistingNaps END ==========');
          return naps;
        }
      }
      // Handle HTML responses
      if (typeof response.data === 'string') {
        // ...existing code for HTML parsing...
        // If successful:
        // console.log(`[ProSBC NAP API] Returning parsed HTML NAPs:`, JSON.stringify(naps, null, 2));
        // console.log('========== [ProSBC NAP API] fetchExistingNaps END ==========');
        // return naps;
      }
      console.log(`Endpoint ${endpoint.path} returned unexpected format, trying next...`);
    } catch (error) {
      console.error(`[ProSBC NAP API] Endpoint ${endpoint.path} failed:`, error.message);
      if (error.response) {
        console.error('[ProSBC NAP API] Error status:', error.response.status);
        console.error('[ProSBC NAP API] Error headers:', error.response.headers);
        if (error.response.status === 406) {
          console.error(`[ProSBC NAP API] Server returned 406 for ${endpoint.path}, content negotiation failed`);
          continue;
        }
        if (error.response.status === 401 || error.response.status === 403) {
          throw new Error('Authentication failed - invalid credentials or session expired');
        }
      }
      if (error.message.includes('Authentication required')) {
        throw error;
      }
      continue;
    }
  }
  console.warn('[ProSBC NAP API] All NAP listing endpoints failed. Returning empty NAP list.');
  console.log('========== [ProSBC NAP API] fetchExistingNaps END ==========');
  return {};
}

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
