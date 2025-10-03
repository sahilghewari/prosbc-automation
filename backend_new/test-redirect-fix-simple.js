#!/usr/bin/env node

/**
 * Simple test script to verify the redirect loop fix
 * Tests ProSBC connections directly without database dependency
 */

import { ProSBCFileAPI } from './utils/prosbc/prosbcFileManager.js';

console.log('='.repeat(80));
console.log('ProSBC Redirect Loop Fix - Simple Verification Test');
console.log('='.repeat(80));
console.log('');

// Test instances directly with hardcoded credentials
const testInstances = [
  {
    id: 'prosbc1',
    name: 'ProSBC NYC1',
    baseUrl: 'https://prosbc1nyc1.dipvtel.com:12358',
    username: 'Monitor',
    password: 'Temp@o25!!'
  },
  {
    id: 'prosbc2',
    name: 'ProSBC NYC2',
    baseUrl: 'https://prosbc1nyc2.dipvtel.com:12358',
    username: 'Monitor',
    password: 'Temp@o25!!'
  },
  {
    id: 'prosbc5',
    name: 'ProSBC TPA2',
    baseUrl: 'http://prosbc5tpa2.dipvtel.com:12358',
    username: 'Monitor',
    password: 'Temp@o25!!'
  }
];

async function testInstanceDirect(instance) {
  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Testing: ${instance.name} (${instance.id})`);
  console.log(`URL: ${instance.baseUrl}`);
  console.log('─'.repeat(80));
  
  try {
    // Create a file manager instance with environment override
    const originalEnv = {
      PROSBC_BASE_URL: process.env.PROSBC_BASE_URL,
      PROSBC_USERNAME: process.env.PROSBC_USERNAME,
      PROSBC_PASSWORD: process.env.PROSBC_PASSWORD
    };
    
    // Set environment for this instance
    process.env.PROSBC_BASE_URL = instance.baseUrl;
    process.env.PROSBC_USERNAME = instance.username;
    process.env.PROSBC_PASSWORD = instance.password;
    
    const fileManager = new ProSBCFileAPI();
    await fileManager.loadInstanceContext();
    
    console.log(`\n[1/2] Testing login and session...`);
    try {
      const sessionCookie = await fileManager.getSessionCookie();
      console.log(`✓ Login successful, session cookie obtained`);
    } catch (loginError) {
      console.log(`✗ Login failed: ${loginError.message}`);
      // Restore env
      Object.assign(process.env, originalEnv);
      return false;
    }
    
    console.log(`\n[2/2] Testing file listing (this would fail with redirect loops)...`);
    try {
      const dmResult = await fileManager.listDmFiles();
      
      if (dmResult.success) {
        console.log(`✓ Successfully listed ${dmResult.files.length} DM files`);
        if (dmResult.files.length > 0) {
          console.log(`   Sample files: ${dmResult.files.slice(0, 3).map(f => f.name).join(', ')}`);
        } else {
          console.log(`   No files found (this may be normal for this instance)`);
        }
      } else {
        console.log(`✗ Failed to list DM files (success=false)`);
        // Restore env
        Object.assign(process.env, originalEnv);
        return false;
      }
    } catch (listError) {
      // Check if this is the redirect error we fixed
      if (listError.message && listError.message.includes('maximum redirect')) {
        console.log(`\n❌ CRITICAL: REDIRECT LOOP ERROR STILL PRESENT!`);
        console.log(`   Error: ${listError.message}`);
        console.log(`   The fix did not work for this instance.`);
        // Restore env
        Object.assign(process.env, originalEnv);
        return false;
      } else if (listError.message && (
        listError.message.includes('ENOTFOUND') || 
        listError.message.includes('ECONNREFUSED') ||
        listError.message.includes('ETIMEDOUT')
      )) {
        console.log(`⚠ Network error (instance may be down): ${listError.message}`);
        // Restore env
        Object.assign(process.env, originalEnv);
        return 'skip';
      } else {
        console.log(`✗ Error listing files: ${listError.message}`);
        console.log(`   This is NOT a redirect loop error.`);
        // Restore env
        Object.assign(process.env, originalEnv);
        return false;
      }
    }
    
    // Restore environment
    Object.assign(process.env, originalEnv);
    
    console.log(`\n✓ All tests passed for ${instance.name}`);
    return true;
    
  } catch (error) {
    console.log(`\n✗ Unexpected error for ${instance.name}: ${error.message}`);
    console.error(error.stack);
    return false;
  }
}

async function runAllTests() {
  console.log('Starting direct tests for ProSBC instances...\n');
  console.log('NOTE: This test bypasses the database and tests ProSBC connections directly.\n');
  
  const results = {
    total: testInstances.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    instances: {}
  };
  
  // Test each instance
  for (const instance of testInstances) {
    const result = await testInstanceDirect(instance);
    results.instances[instance.id] = result;
    
    if (result === true) {
      results.passed++;
    } else if (result === 'skip') {
      results.skipped++;
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
  console.log(`Skipped (Network): ${results.skipped} ⚠`);
  console.log('');
  
  for (const [instanceId, result] of Object.entries(results.instances)) {
    let status;
    if (result === true) {
      status = '✓ PASS';
    } else if (result === 'skip') {
      status = '⚠ SKIP (Network)';
    } else {
      status = '✗ FAIL';
    }
    console.log(`  ${instanceId.padEnd(20)} ${status}`);
  }
  
  console.log('');
  console.log('='.repeat(80));
  
  if (results.failed === 0) {
    if (results.passed > 0) {
      console.log('✓ ALL TESTS PASSED - Redirect loop fix is working!');
      console.log(`  ${results.passed} instance(s) tested successfully`);
      if (results.skipped > 0) {
        console.log(`  ${results.skipped} instance(s) skipped due to network issues`);
      }
    } else if (results.skipped === results.total) {
      console.log('⚠ ALL INSTANCES SKIPPED - Unable to reach any ProSBC instances');
      console.log('  This may indicate network connectivity issues or instances are down');
    } else {
      console.log('⚠ NO TESTS RUN - Please check the configuration');
    }
    process.exit(0);
  } else {
    console.log('✗ SOME TESTS FAILED - Please review the errors above');
    console.log(`  ${results.failed} instance(s) failed`);
    
    // Check if any failures were redirect loops
    let hasRedirectLoopFailure = false;
    for (const instance of testInstances) {
      if (results.instances[instance.id] === false) {
        // We would need to check the actual error, but for now assume it's checked above
      }
    }
    
    process.exit(1);
  }
}

// Run tests
console.log('⚠ NOTE: Make sure the ProSBC instances are reachable from your network');
console.log('⚠ NOTE: This test uses hardcoded credentials from your configuration\n');

runAllTests().catch(error => {
  console.error('\n✗ Unhandled error:', error);
  console.error(error.stack);
  process.exit(1);
});
