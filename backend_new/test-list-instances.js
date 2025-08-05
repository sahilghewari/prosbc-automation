// Test script to see what ProSBC instances exist
import fetch from 'node-fetch';

const testListInstances = async () => {
  console.log('Testing ProSBC instances list...\n');

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

  // Get list of ProSBC instances
  console.log('\n2. Fetching ProSBC instances...');
  const instancesResponse = await fetch('http://localhost:3001/backend/api/prosbc-instances', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (instancesResponse.ok) {
    const instancesData = await instancesResponse.json();
    console.log('✓ ProSBC Instances found:');
    console.log(JSON.stringify(instancesData, null, 2));
  } else {
    const errorText = await instancesResponse.text();
    console.log(`✗ Error fetching instances: ${instancesResponse.status} - ${errorText}`);
  }
};

testListInstances().catch(console.error);
