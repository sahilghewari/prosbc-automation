#!/usr/bin/env node

/**
 * Test script to verify the redirect loop fix
 * This script will test connections to all ProSBC instances
 */

import proSbcInstanceService from './services/proSbcInstanceService.js';
import { ProSBCFileAPI } from './utils/prosbc/prosbcFileManager.js';

console.log('='.repeat(80));
console.log('ProSBC Redirect Loop Fix - Verification Test');
console.log('='.repeat(80));
console.log('');

async function testInstance(instanceId) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Testing Instance: ${instanceId}`);
  console.log('─'.repeat(80));
  
  try {
    // Test 1: Get instance credentials
    console.log(`\n[1/3] Getting credentials for ${instanceId}...`);
    const credentials = await proSbcInstanceService.getInstanceCredentials(instanceId);
    console.log(`✓ Credentials retrieved: ${credentials.baseUrl}`);
    
    // Test 2: Test connection
    console.log(`\n[2/3] Testing connection to ${instanceId}...`);
    const connectionResult = await proSbcInstanceService.testConnection(instanceId);
    if (connectionResult.success) {
      console.log(`✓ Connection successful: ${connectionResult.message}`);
    } else {
      console.log(`✗ Connection failed: ${connectionResult.message}`);
      return false;
    }
    
    // Test 3: List files (this was failing with redirect loops)
    console.log(`\n[3/3] Attempting to list DM files from ${instanceId}...`);
    const fileManager = new ProSBCFileAPI(instanceId);
    
    try {
      const dmResult = await fileManager.listDmFiles();
      if (dmResult.success) {
        console.log(`✓ Successfully listed ${dmResult.files.length} DM files`);
        if (dmResult.files.length > 0) {
          console.log(`   Sample files: ${dmResult.files.slice(0, 3).map(f => f.name).join(', ')}`);
        }
      } else {
        console.log(`✗ Failed to list DM files`);
        return false;
      }
    } catch (error) {
      // Check if this is the redirect error we fixed
      if (error.message && error.message.includes('maximum redirect')) {
        console.log(`✗ REDIRECT LOOP ERROR STILL PRESENT!`);
        console.log(`   Error: ${error.message}`);
        return false;
      } else {
        console.log(`✗ Error (not redirect loop): ${error.message}`);
        return false;
      }
    }
    
    console.log(`\n✓ All tests passed for ${instanceId}`);
    return true;
    
  } catch (error) {
    console.log(`\n✗ Test failed for ${instanceId}: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function runAllTests() {
  console.log('Starting tests for all ProSBC instances...\n');
  
  try {
    // Get all instances
    const instances = await proSbcInstanceService.getAllInstances();
    console.log(`Found ${instances.length} ProSBC instances to test\n`);
    
    const results = {
      total: instances.length,
      passed: 0,
      failed: 0,
      instances: {}
    };
    
    // Test each instance
    for (const instance of instances) {
      const success = await testInstance(instance.id);
      results.instances[instance.id] = success;
      if (success) {
        results.passed++;
      } else {
        results.failed++;
      }
    }
    
    // Summary
    console.log('\n');
    console.log('='.repeat(80));
    console.log('TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Instances: ${results.total}`);
    console.log(`Passed: ${results.passed} ✓`);
    console.log(`Failed: ${results.failed} ✗`);
    console.log('');
    
    for (const [instanceId, success] of Object.entries(results.instances)) {
      const status = success ? '✓ PASS' : '✗ FAIL';
      console.log(`  ${instanceId.padEnd(20)} ${status}`);
    }
    
    console.log('');
    console.log('='.repeat(80));
    
    if (results.failed === 0) {
      console.log('✓ ALL TESTS PASSED - Redirect loop fix is working!');
      process.exit(0);
    } else {
      console.log('✗ SOME TESTS FAILED - Please review the errors above');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n✗ Fatal error during testing:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
