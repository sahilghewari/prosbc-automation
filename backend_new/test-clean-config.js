import fetch from 'node-fetch';

async function testCleanConfigProcessing() {
  console.log('\n=== Testing Clean Config Processing ===');
  
  try {
    // Test the backend with a clean config name
    const testConfig = 'config_052421-1';
    console.log(`Testing with clean config: "${testConfig}"`);
    
    const response = await fetch('http://localhost:3001/backend/api/prosbc-files/test-config-mapping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-config-id': testConfig,
        'X-ProSBC-Instance-ID': '1'
      },
      body: JSON.stringify({ configId: testConfig })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Backend processed config correctly:', result);
    } else {
      console.error('❌ Backend error:', response.status, response.statusText);
    }
    
    // Test with the problematic config (with HTML entity)
    const dirtyConfig = '&nbsp;config_052421-1';
    console.log(`\nTesting with dirty config: "${dirtyConfig}"`);
    
    const response2 = await fetch('http://localhost:3001/backend/api/prosbc-files/test-config-mapping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-config-id': dirtyConfig,
        'X-ProSBC-Instance-ID': '1'
      },
      body: JSON.stringify({ configId: dirtyConfig })
    });
    
    if (response2.ok) {
      const result2 = await response2.json();
      console.log('✅ Backend cleaned and processed dirty config:', result2);
    } else {
      console.error('❌ Backend error with dirty config:', response2.status, response2.statusText);
    }
    
  } catch (error) {
    console.error('Error testing:', error.message);
  }
}

testCleanConfigProcessing();
