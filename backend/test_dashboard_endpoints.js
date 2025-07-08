/**
 * Test script to verify all dashboard endpoints are working
 */

const BASE_URL = 'http://localhost:3001/api/dashboard';

const endpoints = [
  '/overview',
  '/health', 
  '/audit-logs',
  '/file-stats',
  '/performance',
  '/file-upload-trends'
];

async function testEndpoint(endpoint) {
  try {
    console.log(`\n🧪 Testing ${endpoint}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ ${endpoint} - Status: ${response.status}`);
      console.log(`📊 Sample data:`, JSON.stringify(data).substring(0, 200) + '...');
    } else {
      console.log(`❌ ${endpoint} - Status: ${response.status}`);
      console.log(`💥 Error:`, data.message || data.error);
    }
  } catch (error) {
    console.log(`❌ ${endpoint} - Network Error:`, error.message);
  }
}

async function testAllEndpoints() {
  console.log('🚀 Testing Dashboard API Endpoints...\n');
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n✨ Dashboard API Test Complete!');
}

testAllEndpoints();
