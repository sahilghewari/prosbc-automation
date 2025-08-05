// Debug script to test NAP fetching for prosbc3 config 3
import fetch from 'node-fetch';

const debugNapFetching = async () => {
  console.log('Debug: Testing NAP fetching for prosbc3, config 3...\n');

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

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-ProSBC-Instance-ID': 'prosbc3'
  };

  // Test different config IDs to see which ones have NAPs
  const configsToTest = ['config_1', 'config_062425', 'config_demo', '3'];
  
  for (const configId of configsToTest) {
    console.log(`\n=== Testing config: ${configId} ===`);
    
    try {
      const napResponse = await fetch(`http://localhost:3001/backend/api/prosbc-nap-api/instances/prosbc3/configurations/${configId}/naps`, {
        headers
      });
      
      if (napResponse.ok) {
        const napData = await napResponse.json();
        console.log(`  ✓ NAPs for ${configId}: ${napData.naps?.length || 0} found`);
        if (napData.naps && napData.naps.length > 0) {
          console.log(`  ✓ First few NAPs: ${napData.naps.slice(0, 3).map(n => n.name || n.id).join(', ')}`);
        }
      } else {
        const errorText = await napResponse.text();
        console.log(`  ✗ Error for ${configId}: ${napResponse.status} - ${errorText}`);
      }
    } catch (error) {
      console.log(`  ✗ Exception for ${configId}: ${error.message}`);
    }
  }

  // Also test the configs endpoint to see what configs are available
  console.log(`\n=== Available configs for prosbc3 ===`);
  try {
    const configResponse = await fetch('http://localhost:3001/backend/api/prosbc-files/test-configs', {
      headers
    });
    
    if (configResponse.ok) {
      const configData = await configResponse.json();
      console.log(`✓ Available configs: ${configData.configs?.map(c => c.name).join(', ') || 'none'}`);
    }
  } catch (error) {
    console.log(`✗ Error getting configs: ${error.message}`);
  }
};

debugNapFetching().catch(console.error);
