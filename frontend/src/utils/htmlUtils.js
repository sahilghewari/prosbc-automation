/**
 * Utility functions for handling HTML entities and string cleaning
 */

/**
 * Decode HTML entities from a string
 * @param {string} str - String that may contain HTML entities
 * @returns {string} - String with HTML entities decoded
 */
export function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }
  
  return str
    .replace(/&nbsp;/g, ' ')     // Replace HTML non-breaking spaces with regular spaces
    .replace(/&amp;/g, '&')     // Decode HTML ampersands
    .replace(/&lt;/g, '<')      // Decode HTML less-than
    .replace(/&gt;/g, '>')      // Decode HTML greater-than
    .replace(/&quot;/g, '"')    // Decode HTML quotes
    .replace(/&#39;/g, "'")     // Decode HTML single quotes
    .replace(/&#x27;/g, "'")    // Decode HTML single quotes (hex)
    .trim();                    // Remove any extra whitespace
}

/**
 * Clean config name by removing HTML entities and extra whitespace
 * @param {string} configName - Config name that may contain HTML entities
 * @returns {string} - Clean config name
 */
export function cleanConfigName(configName) {
  return decodeHtmlEntities(configName);
}

/**
 * Clean multiple config objects by decoding their names
 * @param {Array} configs - Array of config objects with name property
 * @returns {Array} - Array of config objects with cleaned names
 */
export function cleanConfigs(configs) {
  if (!Array.isArray(configs)) {
    return configs;
  }
  
  return configs.map(config => ({
    ...config,
    name: cleanConfigName(config.name)
  }));
}
