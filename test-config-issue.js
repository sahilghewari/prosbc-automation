// Test script to check ProSBC1 config mapping for the specific issue
const { ProSBCFileAPI } = require('./backend_new/utils/prosbc/prosbcFileManager');

async function testConfigMapping() {
  console.log('=== Testing ProSBC1 Config Mapping Issue ===\n');
  
  // Test with lowercase instance ID 'prosbc1'
  const fileManager = new ProSBCFileAPI('prosbc1');
  
  console.log(`Instance ID: ${fileManager.instanceId}`);
  
  // Test the specific configs mentioned
  const testConfigs = [
    'config_052421-1',  // Should map to ID 2
    '2',                // Should map to config_052421-1
    '4',                // Should map to config_301122-1
    'config_301122-1'   // Should map to ID 4
  ];
  
  console.log('=== Testing Config Resolution ===');
  for (const configId of testConfigs) {
    const mappedConfig = fileManager.resolveProsbc1Config(configId);
    if (mappedConfig) {
      console.log(`✓ Input: '${configId}' → ID: ${mappedConfig.id}, Name: ${mappedConfig.name}`);
    } else {
      console.log(`✗ Input: '${configId}' → No mapping found`);
    }
  }
  
  console.log('\n=== Testing getNumericConfigId Method ===');
  for (const configId of testConfigs) {
    try {
      const numericId = await fileManager.getNumericConfigId(configId);
      console.log(`✓ getNumericConfigId('${configId}') → ${numericId}`);
    } catch (error) {
      console.log(`✗ getNumericConfigId('${configId}') → Error: ${error.message}`);
    }
  }
  
  console.log('\n=== Expected vs Actual ===');
  console.log('Expected: config_052421-1 → ID 2');
  console.log('Expected: ID 4 → config_301122-1');
  console.log('Backend received: Config 4 (should be 2 if frontend sent config_052421-1)');
}

// Run the test
testConfigMapping().catch(console.error);
