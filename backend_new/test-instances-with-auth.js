// Test script to verify instance-specific behavior with proper authentication
import fetch from 'node-fetch';

const testWithAuth = async () => {
  console.log('Testing instance-specific APIs with authentication...\n');

  // First, login to get a token
  console.log('1. Getting authentication token...');
  const loginResponse = await fetch('http://localhost:3001/backend/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      username: 'tpa2admin', 
      password: 'MAkula123!' 
    })
  });

  if (!loginResponse.ok) {
    console.log('Login failed:', await loginResponse.text());
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log('✓ Got authentication token');

  // Test with different instances
  const instances = ['prosbc1', 'prosbc2', 'prosbc3'];
  
  for (const instanceId of instances) {
    console.log(`\n=== Testing Instance ${instanceId} ===`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-ProSBC-Instance-ID': instanceId
    };

    try {
      // Test configs
      console.log(`Testing configs for instance ${instanceId}:`);
      const configResponse = await fetch('http://localhost:3001/backend/api/prosbc-files/test-configs', {
        headers
      });
      
      if (configResponse.ok) {
        const configData = await configResponse.json();
        console.log(`  ✓ Configs: ${configData.configs?.length || 0} found`);
        console.log(`  ✓ Instance: ${configData.instanceId}, Base URL: ${configData.baseURL}`);
        console.log(`  ✓ Config names: ${configData.configs?.map(c => c.name).join(', ') || 'none'}`);
      } else {
        const errorText = await configResponse.text();
        console.log(`  ✗ Config Error: ${configResponse.status} - ${errorText}`);
      }

      // Test NAPs for config_1
      console.log(`Testing NAPs for instance ${instanceId}, config_1:`);
      const napResponse = await fetch(`http://localhost:3001/backend/api/prosbc-nap-api/instances/${instanceId}/configurations/config_1/naps`, {
        headers
      });
      
      if (napResponse.ok) {
        const napData = await napResponse.json();
        console.log(`  ✓ NAPs: ${napData.naps?.length || 0} found`);
        if (napData.naps && napData.naps.length > 0) {
          console.log(`  ✓ First few NAPs: ${napData.naps.slice(0, 3).map(n => n.name).join(', ')}`);
        }
      } else {
        const errorText = await napResponse.text();
        console.log(`  ✗ NAP Error: ${napResponse.status} - ${errorText}`);
      }

      // Test DF files
      console.log(`Testing DF files for instance ${instanceId}:`);
      const dfResponse = await fetch('http://localhost:3001/backend/api/prosbc-files/df/list?configId=config_1', {
        headers
      });
      
      if (dfResponse.ok) {
        const dfData = await dfResponse.json();
        console.log(`  ✓ DF Files: ${dfData.dfFiles?.length || 0} found`);
        if (dfData.dfFiles && dfData.dfFiles.length > 0) {
          console.log(`  ✓ First few files: ${dfData.dfFiles.slice(0, 3).map(f => f.name).join(', ')}`);
        }
      } else {
        const errorText = await dfResponse.text();
        console.log(`  ✗ DF Error: ${dfResponse.status} - ${errorText}`);
      }

    } catch (error) {
      console.log(`  ✗ Exception for instance ${instanceId}: ${error.message}`);
    }

    console.log(''); // Empty line between instances
  }
};

testWithAuth().catch(console.error);
