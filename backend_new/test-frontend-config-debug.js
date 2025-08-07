import fetch from 'node-fetch';

// Test what configs are returned for ProSBC1
async function testConfigsForProSBC1() {
  console.log('\n=== Testing Configs for ProSBC1 ===');
  
  try {
    // Simulate the frontend request to get configs for ProSBC1
    const response = await fetch('http://localhost:3000/backend/api/prosbc-instances/1/configurations', {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('admin:prosbc123').toString('base64')
      }
    });
    
    if (!response.ok) {
      console.error('Failed to fetch configs:', response.status, response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('Configs response:', JSON.stringify(data, null, 2));
    
    if (data.configs) {
      console.log('\nConfig List:');
      data.configs.forEach(cfg => {
        console.log(`- ID: ${cfg.id}, Name: ${cfg.name}, Active: ${cfg.active}`);
      });
      
      // Find config_052421-1
      const config052421 = data.configs.find(cfg => cfg.name === 'config_052421-1');
      if (config052421) {
        console.log(`\nFound config_052421-1: ID = ${config052421.id}`);
      } else {
        console.log('\nconfig_052421-1 not found in configs');
      }
      
      // Find the active config
      const activeConfig = data.configs.find(cfg => cfg.active);
      if (activeConfig) {
        console.log(`Active config: ID = ${activeConfig.id}, Name = ${activeConfig.name}`);
      } else {
        console.log('No active config found');
      }
    }
    
  } catch (error) {
    console.error('Error testing configs:', error);
  }
}

// Run the test
testConfigsForProSBC1();
