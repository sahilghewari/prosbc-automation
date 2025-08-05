// Test script to verify instance-specific API behavior
import fetch from 'node-fetch';

const testInstanceSpecificAPIs = async () => {
  console.log('Testing instance-specific API behavior...\n');

  // Test configs endpoint with different instances
  const instances = [1, 2]; // Test instances 1 and 2
  
  for (const instanceId of instances) {
    console.log(`\n=== Testing Instance ${instanceId} ===`);
    
    try {
      // Test configs endpoint
      console.log(`\n1. Testing configs for instance ${instanceId}:`);
      const configResponse = await fetch('http://localhost:3001/backend/api/prosbc-files/test-configs', {
        headers: {
          'X-ProSBC-Instance-ID': instanceId.toString()
        }
      });
      
      if (configResponse.ok) {
        const configData = await configResponse.json();
        console.log(`   Configs returned:`, configData.configs?.map(c => c.name) || []);
        console.log(`   Instance ID in response:`, configData.instanceId);
      } else {
        console.log(`   Error: ${configResponse.status} - ${await configResponse.text()}`);
      }

      // Test NAPs endpoint
      console.log(`\n2. Testing NAPs for instance ${instanceId}, config_1:`);
      const napResponse = await fetch(`http://localhost:3001/backend/api/prosbc-nap-api/instances/${instanceId}/configurations/config_1/naps`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (napResponse.ok) {
        const napData = await napResponse.json();
        console.log(`   NAPs count:`, napData.naps?.length || 0);
        console.log(`   First few NAPs:`, napData.naps?.slice(0, 3).map(n => n.name) || []);
      } else {
        console.log(`   Error: ${napResponse.status} - ${await napResponse.text()}`);
      }

      // Test DF files endpoint
      console.log(`\n3. Testing DF files for instance ${instanceId}:`);
      const dfResponse = await fetch('http://localhost:3001/backend/api/prosbc-files/df/list?configId=config_1', {
        headers: {
          'X-ProSBC-Instance-ID': instanceId.toString()
        }
      });
      
      if (dfResponse.ok) {
        const dfData = await dfResponse.json();
        console.log(`   DF files count:`, dfData.dfFiles?.length || 0);
        console.log(`   First few DF files:`, dfData.dfFiles?.slice(0, 3).map(f => f.name) || []);
      } else {
        console.log(`   Error: ${dfResponse.status} - ${await dfResponse.text()}`);
      }

    } catch (error) {
      console.log(`   Exception:`, error.message);
    }
  }
};

testInstanceSpecificAPIs().catch(console.error);
