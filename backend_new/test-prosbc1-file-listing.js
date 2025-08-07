import fetch from 'node-fetch';

async function testProSBC1FileListing() {
  console.log('\n=== Testing ProSBC1 File Listing with Hardcoded Config Mappings ===');
  
  const baseUrl = 'http://localhost:3001/backend/api/prosbc-files';
  const testConfigs = [
    'config_052421-1',  // Should map to DB ID 2
    'config_301122-1',  // Should map to DB ID 4
    '2',                // Should map to DB ID 2 (config_052421-1)
    '4'                 // Should map to DB ID 4 (config_301122-1)
  ];
  
  for (const configId of testConfigs) {
    console.log(`\n--- Testing config: ${configId} ---`);
    
    try {
      // Test DF file listing
      console.log(`Testing DF file listing for config: ${configId}`);
      const dfResponse = await fetch(`${baseUrl}/df/list`, {
        headers: {
          'Content-Type': 'application/json',
          'X-ProSBC-Instance-ID': '1',  // ProSBC1
          'x-config-id': configId
        }
      });
      
      if (dfResponse.ok) {
        const dfResult = await dfResponse.json();
        console.log(`✅ DF files for ${configId}:`, dfResult.success ? `${dfResult.files?.length || 0} files` : dfResult.error);
      } else {
        console.log(`❌ DF request failed: ${dfResponse.status}`);
      }
      
      // Test DM file listing
      console.log(`Testing DM file listing for config: ${configId}`);
      const dmResponse = await fetch(`${baseUrl}/dm/list`, {
        headers: {
          'Content-Type': 'application/json',
          'X-ProSBC-Instance-ID': '1',  // ProSBC1
          'x-config-id': configId
        }
      });
      
      if (dmResponse.ok) {
        const dmResult = await dmResponse.json();
        console.log(`✅ DM files for ${configId}:`, dmResult.success ? `${dmResult.files?.length || 0} files` : dmResult.error);
      } else {
        console.log(`❌ DM request failed: ${dmResponse.status}`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${configId}:`, error.message);
    }
  }
  
  console.log('\n=== Test Complete ===');
}

testProSBC1FileListing();
