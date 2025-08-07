import express from 'express';

// Create a minimal test to simulate the getConfigIdFromRequest function
function getConfigIdFromRequest(req) {
  const configFromQuery = req.query.configId;
  const configFromBody = req.body?.configId;
  const configFromHeaderId = req.headers['x-config-id'];
  const configFromHeaderProsbcId = req.headers['x-prosbc-config-id'];
  
  // Debug logging to see what the frontend is sending
  console.log(`[Config Debug] Query configId: ${configFromQuery}`);
  console.log(`[Config Debug] Body configId: ${configFromBody}`);
  console.log(`[Config Debug] Header x-config-id: ${configFromHeaderId}`);
  console.log(`[Config Debug] Header x-prosbc-config-id: ${configFromHeaderProsbcId}`);
  
  const finalConfigId = configFromQuery || configFromBody || configFromHeaderId || configFromHeaderProsbcId || null;
  console.log(`[Config Debug] Final selected configId: ${finalConfigId}`);
  
  return finalConfigId;
}

// Simulate different request scenarios
console.log('=== Scenario 1: Frontend sends config_052421-1 in body ===');
const req1 = {
  query: {},
  body: { configId: 'config_052421-1', fileType: 'dm' },
  headers: {}
};
getConfigIdFromRequest(req1);

console.log('\n=== Scenario 2: Frontend sends numeric ID 4 in body ===');
const req2 = {
  query: {},
  body: { configId: '4', fileType: 'dm' },
  headers: {}
};
getConfigIdFromRequest(req2);

console.log('\n=== Scenario 3: Frontend sends config_052421-1 in query ===');
const req3 = {
  query: { configId: 'config_052421-1' },
  body: { fileType: 'dm' },
  headers: {}
};
getConfigIdFromRequest(req3);

console.log('\n=== Scenario 4: Frontend sends via header ===');
const req4 = {
  query: {},
  body: { fileType: 'dm' },
  headers: { 'x-config-id': 'config_052421-1' }
};
getConfigIdFromRequest(req4);

console.log('\n=== Scenario 5: Multiple sources (query wins) ===');
const req5 = {
  query: { configId: 'config_052421-1' },
  body: { configId: '4', fileType: 'dm' },
  headers: { 'x-config-id': 'config_301122-1' }
};
getConfigIdFromRequest(req5);

// Now let's test the ProSBC1 mapping logic
function resolveProsbc1Config(configId, instanceId = 'prosbc1') {
  const prosbc1ConfigMappings = {
    'config_052421-1': { id: '2', name: 'config_052421-1' },
    'config_060620221': { id: '3', name: 'config_060620221' },
    'config_1': { id: '1', name: 'config_1' },
    'config_1-BU': { id: '5', name: 'config_1-BU' },
    'config_301122-1': { id: '4', name: 'config_301122-1' },
    'config_demo': { id: '6', name: 'config_demo' },
    // Also support lookup by ID
    '1': { id: '1', name: 'config_1' },
    '2': { id: '2', name: 'config_052421-1' },
    '3': { id: '3', name: 'config_060620221' },
    '4': { id: '4', name: 'config_301122-1' },
    '5': { id: '5', name: 'config_1-BU' },
    '6': { id: '6', name: 'config_demo' }
  };

  if (!instanceId || instanceId.toLowerCase() !== 'prosbc1') {
    return null; // Only works for ProSBC1
  }
  
  if (!configId) {
    // Return default config if none specified
    return prosbc1ConfigMappings['config_1'];
  }
  
  // Convert to string for consistent lookup
  const configKey = configId.toString();
  
  // Direct lookup in hardcoded mappings
  const mappedConfig = prosbc1ConfigMappings[configKey];
  if (mappedConfig) {
    console.log(`[ProSBC1 Config] Mapped '${configId}' to ID: ${mappedConfig.id}, Name: ${mappedConfig.name}`);
    return mappedConfig;
  }
  
  console.warn(`[ProSBC1 Config] No mapping found for '${configId}'`);
  return prosbc1ConfigMappings['config_1'];
}

console.log('\n=== ProSBC1 Config Mapping Tests ===');
console.log('Test: config_052421-1 →', resolveProsbc1Config('config_052421-1'));
console.log('Test: 4 →', resolveProsbc1Config('4'));
console.log('Test: 2 →', resolveProsbc1Config('2'));
console.log('Test: config_301122-1 →', resolveProsbc1Config('config_301122-1'));
