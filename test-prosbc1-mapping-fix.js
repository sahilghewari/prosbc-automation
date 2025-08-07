// Test script to verify ProSBC1 hardcoded mapping is working correctly
const { ProSBCFileAPI } = require('./backend_new/utils/prosbc/prosbcFileManager');

async function testProSBC1Mapping() {
  console.log('=== Testing ProSBC1 Hardcoded Mapping Fix ===\n');
  
  // Test with lowercase instance ID 'prosbc1'
  const fileManager = new ProSBCFileAPI('prosbc1');
  
  console.log(`Instance ID: ${fileManager.instanceId}`);
  console.log(`Hardcoded mappings available: ${Object.keys(fileManager.prosbc1ConfigMappings).filter(k => k.startsWith('config_')).length} configs\n`);
  
  // Test config resolution
  const testConfigs = ['4', 'config_301122-1', '2', 'config_demo'];
  
  for (const configId of testConfigs) {
    const mappedConfig = fileManager.resolveProsbc1Config(configId);
    if (mappedConfig) {
      console.log(`✓ Config '${configId}' → ID: ${mappedConfig.id}, Name: ${mappedConfig.name}`);
    } else {
      console.log(`✗ Config '${configId}' → No mapping found`);
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
  
  console.log('\n=== Testing getConfigName Method ===');
  for (const configId of testConfigs) {
    try {
      const configName = await fileManager.getConfigName(configId);
      console.log(`✓ getConfigName('${configId}') → ${configName}`);
    } catch (error) {
      console.log(`✗ getConfigName('${configId}') → Error: ${error.message}`);
    }
  }
  
  console.log('\n=== Test Complete ===');
  console.log('The hardcoded mapping should now work correctly for lowercase instance ID "prosbc1"');
}

// Run the test
testProSBC1Mapping().catch(console.error);
