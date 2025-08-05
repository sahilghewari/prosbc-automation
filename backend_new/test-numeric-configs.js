// Test script to find which config has the NAPs using numeric config IDs
import fetch from 'node-fetch';

const testNumericConfigs = async () => {
  console.log('Testing NAP fetching with numeric config IDs...\n');

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

  // Test numeric config IDs (from the HTML dropdown: 1, 2, 3, 4, 5, 6)
  const numericConfigIds = [1, 2, 3, 4, 5, 6];
  
  for (const configId of numericConfigIds) {
    console.log(`\n=== Testing numeric config ID: ${configId} ===`);
    
    try {
      const napResponse = await fetch(`http://localhost:3001/backend/api/prosbc-nap-api/instances/prosbc3/configurations/${configId}/naps`, {
        headers
      });
      
      if (napResponse.ok) {
        const napData = await napResponse.json();
        console.log(`  ✓ NAPs for config ${configId}: ${napData.naps?.length || 0} found`);
        if (napData.naps && napData.naps.length > 0) {
          console.log(`  ✓ First few NAPs: ${napData.naps.slice(0, 5).map(n => n.name || n.number || n.id).join(', ')}`);
          if (napData.naps.length >= 50) {
            console.log(`  🎯 FOUND IT! Config ${configId} has ${napData.naps.length} NAPs - this is likely the one with 50-60 NAPs!`);
          }
        }
      } else {
        const errorText = await napResponse.text();
        console.log(`  ✗ Error for config ${configId}: ${napResponse.status} - ${errorText.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`  ✗ Exception for config ${configId}: ${error.message}`);
    }
  }
};

testNumericConfigs().catch(console.error);
