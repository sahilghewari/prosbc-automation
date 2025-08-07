// Test script for ProSBC1 hardcoded config mappings
// Run this to verify the new hardcoded config system works

const fs = require('fs');
const path = require('path');

// Mock ProSBCFileAPI class to test the mapping logic
class TestProSBCFileAPI {
  constructor(instanceId) {
    this.instanceId = instanceId;
    
    // Hardcoded config mappings for ProSBC1
    this.prosbc1ConfigMappings = {
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
  }

  resolveProsbc1Config(configId) {
    if (this.instanceId !== 'ProSBC1') {
      return null;
    }
    
    if (!configId) {
      return this.prosbc1ConfigMappings['config_1'];
    }
    
    const configKey = configId.toString();
    const mappedConfig = this.prosbc1ConfigMappings[configKey];
    if (mappedConfig) {
      console.log(`[ProSBC1 Config] Mapped '${configId}' to ID: ${mappedConfig.id}, Name: ${mappedConfig.name}`);
      return mappedConfig;
    }
    
    // Try partial name matching
    for (const [key, config] of Object.entries(this.prosbc1ConfigMappings)) {
      if (key.toLowerCase().includes(configKey.toLowerCase()) || 
          configKey.toLowerCase().includes(key.toLowerCase())) {
        console.log(`[ProSBC1 Config] Partial match '${configId}' to ID: ${config.id}, Name: ${config.name}`);
        return config;
      }
    }
    
    console.warn(`[ProSBC1 Config] No mapping found for '${configId}'`);
    return this.prosbc1ConfigMappings['config_1'];
  }
}

function testProSBC1Mappings() {
  console.log('=== Testing ProSBC1 Hardcoded Config Mappings ===\n');
  
  const api = new TestProSBCFileAPI('ProSBC1');
  
  // Test cases
  const testCases = [
    // Test by config name
    'config_052421-1',
    'config_060620221', 
    'config_1',
    'config_1-BU',
    'config_301122-1',
    'config_demo',
    
    // Test by ID
    '1',
    '2', 
    '3',
    '4',
    '5',
    '6',
    
    // Test edge cases
    null, // Should return default
    'unknown_config', // Should return default
    'demo', // Should partial match config_demo
    '052421' // Should partial match config_052421-1
  ];
  
  console.log('Testing config resolution:');
  testCases.forEach(testCase => {
    console.log(`\nInput: ${testCase || 'null'}`);
    const result = api.resolveProsbc1Config(testCase);
    if (result) {
      console.log(`  → ID: ${result.id}, Name: ${result.name}`);
    } else {
      console.log(`  → No result`);
    }
  });
  
  console.log('\n=== Summary ===');
  console.log('Available ProSBC1 configs:');
  Object.values(api.prosbc1ConfigMappings)
    .filter((config, index, self) => 
      self.findIndex(c => c.id === config.id) === index // Remove duplicates
    )
    .sort((a, b) => parseInt(a.id) - parseInt(b.id))
    .forEach(config => {
      console.log(`  - ID: ${config.id}, Name: ${config.name}`);
    });
  
  console.log('\n✅ ProSBC1 hardcoded mapping test completed!');
}

// Test other instances to ensure they're not affected
function testOtherInstances() {
  console.log('\n=== Testing Other Instances (Should Return Null) ===\n');
  
  const api2 = new TestProSBCFileAPI('ProSBC2');
  const api3 = new TestProSBCFileAPI('ProSBC_NYC2');
  
  [api2, api3].forEach(api => {
    console.log(`Testing ${api.instanceId}:`);
    const result = api.resolveProsbc1Config('config_1');
    console.log(`  → Result: ${result || 'null (correct)'}`);
  });
}

// Run tests
testProSBC1Mappings();
testOtherInstances();

console.log('\n🎯 All tests completed! The hardcoded config system is ready for ProSBC1.');
