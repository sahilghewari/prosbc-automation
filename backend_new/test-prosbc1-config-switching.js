import { ProSBCFileAPI } from './utils/prosbc/prosbcFileManager.js';

async function testProSBC1ConfigSwitching() {
  console.log('=== Testing ProSBC1 Configuration Switching with Database ID Mapping ===\n');
  
  const api = new ProSBCFileAPI('prosbc1');
  
  const testConfigs = [
    'config_052421-1',   // Should select config 2, use database 2
    'config_1-BU',       // Should select config 5, use database 3
    'config_060620221',  // Should select config 3, use database 3
    'config_301122-1'    // Should select config 4, use database 4
  ];
  
  for (const configId of testConfigs) {
    try {
      console.log(`\n--- Testing Config: ${configId} ---`);
      
      // Reset the configuration selection state
      api.configSelectionDone = false;
      api.selectedConfigId = null;
      
      // Test configuration selection and file listing
      const dfFiles = await api.listDfFiles(configId);
      console.log(`✓ Successfully listed DF files for ${configId}`);
      console.log(`  Found ${dfFiles.files ? dfFiles.files.length : 0} DF files`);
      
      const dmFiles = await api.listDmFiles(configId);
      console.log(`✓ Successfully listed DM files for ${configId}`);
      console.log(`  Found ${dmFiles.files ? dmFiles.files.length : 0} DM files`);
      
      console.log(`  Final database ID used: ${api.selectedConfigId}`);
      
    } catch (error) {
      console.error(`✗ Error testing config ${configId}:`, error.message);
    }
  }
  
  console.log('\n=== Test completed ===');
}

// Run the test
testProSBC1ConfigSwitching().catch(console.error);
