// --- Robust HTML file table parser for DF/DM files ---
// Returns an array of file objects with correct configId from HTML URLs
export function parseFileTableSection(sectionHtml, type = 'routesets_digitmaps') {
  const files = [];
  // Match each <tr>...</tr> that contains a file row
  const rowRegex = /<tr>\s*<td>([^<]+)<\/td>\s*([\s\S]*?)<\/tr>/g;
  let match;
  while ((match = rowRegex.exec(sectionHtml)) !== null) {
    const fileName = match[1].trim();
    const rowHtml = match[2];
    // Find all action URLs in this row
    const urlRegex = /href="(\/file_dbs\/(\d+)\/(routesets_digitmaps|routesets_definitions)\/(\d+)(?:\/(edit|export))?)"/g;
    let updateUrl = null, exportUrl = null, deleteUrl = null, htmlConfigId = null, fileId = null;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(rowHtml)) !== null) {
      const url = urlMatch[1];
      const configId = urlMatch[2];
      const urlType = urlMatch[3];
      const id = urlMatch[4];
      const action = urlMatch[5];
      if (!htmlConfigId) htmlConfigId = configId;
      if (!fileId) fileId = id;
      if (action === 'edit') updateUrl = url;
      else if (action === 'export') exportUrl = url;
      else if (!action) deleteUrl = url; // delete is just the base URL
    }
    if (fileName && htmlConfigId && fileId) {
      files.push({
        id: fileId,
        name: fileName,
        type,
        updateUrl,
        exportUrl,
        deleteUrl,
        configId: htmlConfigId,
      });
    }
  }
  return files;
}
// Ensure the ProSBC session is switched to the correct config before any NAP operation
const ensureConfigSelected = async (configId, client = null) => {
  if (!configId) configId = 'config_1';
  const apiClientToUse = client || apiClient;
  
  try {
    console.log(`[ProSBC] Switching to config: ${configId}`);
    const res = await apiClientToUse.get(`/configurations/${configId}/choose_redirect`, {
      headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    });
    console.log(`[ProSBC] /choose_redirect status: ${res.status}`);
    if (res.headers && res.headers['set-cookie']) {
      console.log('[ProSBC] Set-Cookie:', res.headers['set-cookie']);
    }
    // Immediately check which config is active by fetching the edit page and logging the config name
    const checkRes = await apiClient.get(`/configurations/${configId}/edit`, {
      headers: { 'Accept': 'text/html' }
    });
    
    // Ensure checkRes.data is a string before calling match
    if (typeof checkRes.data === 'string') {
      const match = checkRes.data.match(/<td class="edit_link">(config_[^<]+)<\/td>/);
      if (match && match[1]) {
        console.log(`[ProSBC] Confirmed config switched to: ${match[1]}`);
        if (match[1] !== configId) {
          console.warn(`[ProSBC] WARNING: Active config in HTML is ${match[1]}, expected ${configId}`);
        }
      } else {
        console.warn('[ProSBC] Could not confirm active config from HTML - no match found');
      }
    } else {
      console.warn(`[ProSBC] Could not confirm active config - response data is not a string (type: ${typeof checkRes.data})`);
    }
  } catch (error) {
    console.error(`Failed to select config ${configId}:`, error.message);
    // Don't throw, allow NAP operation to proceed (may fail if config not switched)
  }
};
// NAP Management API Client - Using Basic Auth with Environment Variables - Fixed Version

// Allow self-signed certificates for development (do not use in production)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
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
import { JSDOM } from 'jsdom';
import { getInstanceContext } from './multiInstanceManager.js';

// Store multiple API clients for different instances
const apiClientInstances = new Map();

// Get credentials from environment variables (fallback)
const getCredentials = () => {
  const username = process.env.PROSBC_USERNAME;
  const password = process.env.PROSBC_PASSWORD;
  if (!username || !password) {
    throw new Error('ProSBC credentials not found. Please set PROSBC_USERNAME and PROSBC_PASSWORD in your .env file');
  }
  return { username, password };
};

// Create an instance-specific axios client
const createApiClient = async (instanceId = null) => {
  let config = {};
  
  if (instanceId) {
    // Get instance-specific configuration
    const instanceContext = await getInstanceContext(instanceId);
    config = {
      baseURL: instanceContext.baseUrl,
      timeout: 120000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/html, */*',
      },
    };
    console.log(`[NAP API Client] Created client for instance: ${instanceContext.name} (${instanceContext.baseUrl})`);
  } else {
    // Fallback to environment variables
    config = {
      baseURL: process.env.PROSBC_BASE_URL,
      timeout: 120000,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/html, */*',
      },
    };
    console.log(`[NAP API Client] Created client using environment variables: ${config.baseURL}`);
  }
  
  return axios.create(config);
};

// Get or create API client for specific instance
const getApiClient = async (instanceId = null) => {
  const key = instanceId || 'default';
  
  if (!apiClientInstances.has(key)) {
    const client = await createApiClient(instanceId);
    apiClientInstances.set(key, client);
  }
  
  return apiClientInstances.get(key);
};

// Legacy global client for backward compatibility
const apiClient = axios.create({
  baseURL: process.env.PROSBC_BASE_URL,
  timeout: 120000,
  withCredentials: true,
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
      const authString = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      config.headers.Authorization = `Basic ${authString}`;
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

// List all NAPs in a configuration (RESTful, JSON)
export const fetchExistingNaps = async (configId = 'config_1') => {
  try {
    await ensureConfigSelected(configId);
    console.log(`[ProSBC] Fetching NAPs for config: ${configId}`);
    const response = await apiClient.get(`/configurations/${configId}/naps`, {
      headers: { 'Accept': 'application/json' }
    });
    console.log(`[ProSBC] NAPs response status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching NAPs:', error);
    throw error;
  }
};
// Add similar debug logging for file fetches
export const fetchDfFiles = async (configId = 'config_1') => {
  try {
    await ensureConfigSelected(configId);
    console.log(`[ProSBC] Fetching DF files for config: ${configId}`);
    const response = await apiClient.get(`/file_dbs/${configId}/routesets_definitions`, {
      headers: { 'Accept': 'text/html' }
    });
    console.log(`[ProSBC] DF files response status: ${response.status}`);
    console.log(`[ProSBC] HTML length: ${response.data.length}`);
    // Find the <table class="list">...</table> for DF files
    const tableMatch = response.data.match(/<table class="list">([\s\S]*?)<\/table>/);
    if (!tableMatch) {
      console.warn('[ProSBC] Could not find DF files table in HTML');
      return [];
    }
    const files = parseFileTableSection(tableMatch[0], 'routesets_definitions');
    return files;
  } catch (error) {
    console.error('Error fetching DF files:', error);
    throw error;
  }
};

export const fetchDmFiles = async (configId = 'config_1') => {
  try {
    await ensureConfigSelected(configId);
    console.log(`[ProSBC] Fetching DM files for config: ${configId}`);
    const response = await apiClient.get(`/file_dbs/${configId}/routesets_digitmaps`, {
      headers: { 'Accept': 'text/html' }
    });
    console.log(`[ProSBC] DM files response status: ${response.status}`);
    console.log(`[ProSBC] HTML length: ${response.data.length}`);
    // Find the <table class="list">...</table> for DM files
    const tableMatch = response.data.match(/<table class="list">([\s\S]*?)<\/table>/);
    if (!tableMatch) {
      console.warn('[ProSBC] Could not find DM files table in HTML');
      return [];
    }
    const files = parseFileTableSection(tableMatch[0], 'routesets_digitmaps');
    return files;
  } catch (error) {
    console.error('Error fetching DM files:', error);
    throw error;
  }
};

// Function to check if NAP name already exists (RESTful)
export const checkNapExists = async (napName, configId = 'config_1') => {
  try {
    await ensureConfigSelected(configId);
    const response = await apiClient.get(`/configurations/${configId}/naps/${encodeURIComponent(napName)}`, {
      headers: { 'Accept': 'application/json' }
    });
    return !!response.data && response.status === 200;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return false;
    }
    console.error('Error checking NAP existence:', error);
    throw error;
  }
};

// Create a new NAP (RESTful, JSON)
export const createNap = async (napData, configId = 'config_1') => {
  try {
    await ensureConfigSelected(configId);
    const response = await apiClient.post(
      `/configurations/${configId}/naps`,
      napData,
      { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating NAP:', error);
    throw error;
  }
};

// Fetch live NAP data from ProSBC (alias for fetchExistingNaps, RESTful)
export const fetchLiveNaps = async (configId = 'config_1') => {
  return fetchExistingNaps(configId);
};

// Delete a NAP (RESTful, JSON)
export const deleteNap = async (napName, configId = 'config_1') => {
  try {
    await ensureConfigSelected(configId);
    const response = await apiClient.delete(`/configurations/${configId}/naps/${encodeURIComponent(napName)}`, {
      headers: { 'Accept': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting NAP:', error);
    throw error;
  }
};

// Update a NAP (RESTful, JSON)
export const updateNap = async (napName, napData, configId = 'config_1') => {
  try {
    await ensureConfigSelected(configId);
    const response = await apiClient.put(
      `/configurations/${configId}/naps/${encodeURIComponent(napName)}`,
      napData,
      { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating NAP:', error);
    throw error;
  }
};
// Get a specific NAP's details (RESTful, JSON)
export const getNap = async (napName, configId = 'config_1') => {
  try {
    await ensureConfigSelected(configId);
    const response = await apiClient.get(`/configurations/${configId}/naps/${encodeURIComponent(napName)}`, {
      headers: { 'Accept': 'application/json' }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching NAP details:', error);
    throw error;
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
export const createSipProxyNap = async (napData, configId = 'config_1') => {
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
  return await createNap(sipProxyConfig, configId);
};

// Helper function to create simple NAP (name only)
export const createSimpleNap = async (name, enabled = true, configId = 'config_1') => {
  return await createNap({
    name: name,
    enabled: enabled
  }, configId);
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

// Instance-specific helper functions
export const createInstanceApiClient = async (instanceId) => {
  return await getApiClient(instanceId);
};

export const fetchExistingNapsByInstance = async (configId = 'config_1', instanceId) => {
  return fetchExistingNaps(configId, instanceId);
};

export const fetchDfFilesByInstance = async (configId = 'config_1', instanceId) => {
  return fetchDfFiles(configId, instanceId);
};

export const fetchDmFilesByInstance = async (configId = 'config_1', instanceId) => {
  return fetchDmFiles(configId, instanceId);
};

// Export the getApiClient function for advanced use cases
export { getApiClient };

export default apiClient;
