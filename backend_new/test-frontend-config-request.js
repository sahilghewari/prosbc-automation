import FormData from 'form-data';
import fetch from 'node-fetch';
import fs from 'fs';

async function testFrontendConfigRequest() {
  console.log('Testing frontend config request simulation...');
  
  // Create a small test CSV file
  const testCsvContent = 'name,value\ntest1,123\ntest2,456\n';
  const testFilePath = './test-upload.csv';
  fs.writeFileSync(testFilePath, testCsvContent);
  
  try {
    // Test 1: Simulate what frontend sends when config_052421-1 is selected
    console.log('\n=== Test 1: Frontend sends config_052421-1 (as string) ===');
    const formData1 = new FormData();
    formData1.append('file', fs.createReadStream(testFilePath));
    formData1.append('fileType', 'dm');
    formData1.append('configId', 'config_052421-1'); // What frontend should send
    formData1.append('instanceId', 'prosbc1');
    
    const response1 = await fetch('http://localhost:3001/api/prosbc-files/upload', {
      method: 'POST',
      body: formData1,
      headers: {
        'x-prosbc-instance-id': 'prosbc1'
      }
    });
    
    const result1 = await response1.text();
    console.log('Response Status:', response1.status);
    console.log('Response:', result1.substring(0, 500));
    
    console.log('\n=== Test 2: Frontend sends numeric ID 4 (wrong mapping) ===');
    const formData2 = new FormData();
    formData2.append('file', fs.createReadStream(testFilePath));
    formData2.append('fileType', 'dm');
    formData2.append('configId', '4'); // What frontend is incorrectly sending
    formData2.append('instanceId', 'prosbc1');
    
    const response2 = await fetch('http://localhost:3001/api/prosbc-files/upload', {
      method: 'POST',
      body: formData2,
      headers: {
        'x-prosbc-instance-id': 'prosbc1'
      }
    });
    
    const result2 = await response2.text();
    console.log('Response Status:', response2.status);
    console.log('Response:', result2.substring(0, 500));
    
    console.log('\n=== Test 3: Frontend sends configId in query params ===');
    const formData3 = new FormData();
    formData3.append('file', fs.createReadStream(testFilePath));
    formData3.append('fileType', 'dm');
    formData3.append('instanceId', 'prosbc1');
    
    const response3 = await fetch('http://localhost:3001/api/prosbc-files/upload?configId=config_052421-1', {
      method: 'POST',
      body: formData3,
      headers: {
        'x-prosbc-instance-id': 'prosbc1'
      }
    });
    
    const result3 = await response3.text();
    console.log('Response Status:', response3.status);
    console.log('Response:', result3.substring(0, 500));
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    // Cleanup
    try {
      fs.unlinkSync(testFilePath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

testFrontendConfigRequest();
