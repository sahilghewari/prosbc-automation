#!/usr/bin/env node

// Test script to verify config loading fixes for Ubuntu deployment
import fetch from 'node-fetch';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const TEST_TOKEN = process.env.TEST_TOKEN; // You should set this to a valid dashboard token

async function testConfigLoading() {
  console.log('=== Testing Config Loading Fix ===\n');
  
  if (!TEST_TOKEN) {
    console.error('Please set TEST_TOKEN environment variable with a valid dashboard token');
    process.exit(1);
  }
  
  try {
    // Test 1: Get ProSBC instances
    console.log('1. Testing ProSBC instances fetch...');
    const instancesResponse = await fetch(`${BACKEND_URL}/backend/api/prosbc-instances`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!instancesResponse.ok) {
      throw new Error(`Instances fetch failed: ${instancesResponse.status}`);
    }
    
    const instancesData = await instancesResponse.json();
    console.log('✓ Instances fetched successfully');
    console.log(`  Found ${instancesData.instances?.length || 0} instances`);
    
    if (!instancesData.instances || instancesData.instances.length === 0) {
      console.log('⚠ No instances found - cannot test config loading');
      return;
    }
    
    // Test 2: Get configs for first instance
    const firstInstance = instancesData.instances[0];
    console.log(`\n2. Testing config fetch for instance: ${firstInstance.id} (${firstInstance.name})`);
    
    const configsResponse = await fetch(`${BACKEND_URL}/backend/api/prosbc-files/test-configs`, {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
        'X-ProSBC-Instance-ID': firstInstance.id.toString()
      }
    });
    
    if (!configsResponse.ok) {
      throw new Error(`Config fetch failed: ${configsResponse.status}`);
    }
    
    const configsData = await configsResponse.json();
    
    if (configsData.success) {
      console.log('✓ Configs fetched successfully');
      console.log(`  Found ${configsData.configs?.length || 0} configs`);
      
      if (configsData.configs && configsData.configs.length > 0) {
        console.log('  Config details:');
        configsData.configs.forEach(cfg => {
          console.log(`    - ID: ${cfg.id}, Name: ${cfg.name}, Active: ${cfg.active}, Selected: ${cfg.isSelected}`);
        });
        
        // Check if there's a selected config
        const selectedConfig = configsData.configs.find(cfg => cfg.isSelected);
        if (selectedConfig) {
          console.log(`  ✓ Active config found: ${selectedConfig.name}`);
        } else {
          console.log('  ⚠ No active config found');
        }
      } else {
        console.log('  ⚠ No configs returned');
      }
    } else {
      throw new Error(`Config fetch unsuccessful: ${configsData.error}`);
    }
    
    // Test 3: Test cache clearing
    console.log('\n3. Testing cache clearing...');
    const cacheResponse = await fetch(`${BACKEND_URL}/backend/api/prosbc-instances/clear-cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ instanceId: firstInstance.id })
    });
    
    if (cacheResponse.ok) {
      const cacheData = await cacheResponse.json();
      console.log('✓ Cache clearing successful');
      console.log(`  Message: ${cacheData.message}`);
    } else {
      console.log('⚠ Cache clearing failed (this is non-critical)');
    }
    
    console.log('\n=== All Tests Completed Successfully ===');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testConfigLoading();
