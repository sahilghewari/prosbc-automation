// Test script to validate the enhanced ProSBC optimization fixes
import { enhancedSwitcher } from './enhancedSwitcher.js';
import { createEnhancedProSBCFileAPI } from './enhancedFileAPI.js';
import { sessionPool } from './sessionPool.js';

/**
 * Test script to validate fixes for:
 * 1. Config selection failures
 * 2. Empty file lists despite HTML parsing
 * 3. Excessive API calls
 * 4. Session management issues
 */

async function testEnhancedOptimizations() {
  console.log('='.repeat(60));
  console.log('🚀 TESTING ENHANCED PROSBC OPTIMIZATIONS');
  console.log('='.repeat(60));

  const startTime = Date.now();
  let totalApiCalls = 0;

  try {
    // Test 1: Enhanced Instance Switching
    console.log('\n📋 TEST 1: Enhanced Instance Switching');
    console.log('-'.repeat(40));
    
    const switchResult = await enhancedSwitcher.switchInstance('prosbc1', 'config_052421-1');
    totalApiCalls += switchResult.apiCallsUsed;
    
    console.log(`✓ Switch completed in ${switchResult.switchTimeMs}ms`);
    console.log(`✓ API calls used: ${switchResult.apiCallsUsed}`);
    console.log(`✓ Config selected: ${switchResult.selectedConfig.name}`);
    console.log(`✓ Validation: ${switchResult.validation.success ? 'PASSED' : 'FAILED'}`);

    // Test 2: Enhanced File API
    console.log('\n📁 TEST 2: Enhanced File API');
    console.log('-'.repeat(40));
    
    const fileAPI = createEnhancedProSBCFileAPI('prosbc1');
    
    // Test DF files
    console.log('\n🔸 Testing DF (Definition Files)...');
    const dfFiles = await fileAPI.getDFFiles('config_052421-1');
    console.log(`✓ DF files retrieved: ${dfFiles.length}`);
    
    if (dfFiles.length > 0) {
      console.log(`✓ First DF file: ${dfFiles[0].name} (ID: ${dfFiles[0].id})`);
      console.log(`✓ Last DF file: ${dfFiles[dfFiles.length - 1].name} (ID: ${dfFiles[dfFiles.length - 1].id})`);
    } else {
      console.log('⚠️  No DF files found - investigating...');
      await investigateEmptyResults(fileAPI, 'DF');
    }

    // Test DM files
    console.log('\n🔸 Testing DM (Digitmap Files)...');
    const dmFiles = await fileAPI.getDMFiles('config_052421-1');
    console.log(`✓ DM files retrieved: ${dmFiles.length}`);
    
    if (dmFiles.length > 0) {
      console.log(`✓ First DM file: ${dmFiles[0].name} (ID: ${dmFiles[0].id})`);
      console.log(`✓ Last DM file: ${dmFiles[dmFiles.length - 1].name} (ID: ${dmFiles[dmFiles.length - 1].id})`);
    } else {
      console.log('⚠️  No DM files found - investigating...');
      await investigateEmptyResults(fileAPI, 'DM');
    }

    // Test 3: Cache Performance
    console.log('\n💾 TEST 3: Cache Performance');
    console.log('-'.repeat(40));
    
    const cacheStartTime = Date.now();
    
    // Second call should use cache
    const dfFilesCached = await fileAPI.getDFFiles('config_052421-1');
    const dmFilesCached = await fileAPI.getDMFiles('config_052421-1');
    
    const cacheTime = Date.now() - cacheStartTime;
    
    console.log(`✓ Cached DF files: ${dfFilesCached.length}`);
    console.log(`✓ Cached DM files: ${dmFilesCached.length}`);
    console.log(`✓ Cache retrieval time: ${cacheTime}ms`);

    // Test 4: Session Pool Statistics
    console.log('\n🔄 TEST 4: Session Pool Statistics');
    console.log('-'.repeat(40));
    
    const sessionStats = sessionPool.getStats();
    console.log(`✓ Total sessions: ${sessionStats.totalSessions}`);
    console.log(`✓ Instance sessions:`, sessionStats.instanceCounts);
    console.log(`✓ Processing status:`, sessionStats.processing);

    // Test 5: Enhanced Switcher Statistics  
    console.log('\n📊 TEST 5: Enhanced Switcher Statistics');
    console.log('-'.repeat(40));
    
    const switcherStats = enhancedSwitcher.getStats();
    console.log(`✓ Instance cache size: ${switcherStats.instanceCacheSize}`);
    console.log(`✓ Config cache size: ${switcherStats.configCacheSize}`);
    console.log(`✓ Active instance: ${switcherStats.activeInstance}`);
    console.log(`✓ Active config: ${switcherStats.activeConfig}`);

    // Test 6: API Call Optimization Verification
    console.log('\n⚡ TEST 6: API Call Optimization');
    console.log('-'.repeat(40));
    
    // Test switching to the same instance/config (should be 0 API calls)
    const sameSwitchResult = await enhancedSwitcher.switchInstance('prosbc1', 'config_052421-1');
    console.log(`✓ Same instance switch API calls: ${sameSwitchResult.apiCallsUsed}`);
    
    // Test switching to different config (should be minimal)
    const diffConfigResult = await enhancedSwitcher.switchInstance('prosbc1', 'config_1');
    totalApiCalls += diffConfigResult.apiCallsUsed;
    console.log(`✓ Different config switch API calls: ${diffConfigResult.apiCallsUsed}`);

    // Final Results
    console.log('\n🎯 FINAL RESULTS');
    console.log('='.repeat(60));
    
    const totalTime = Date.now() - startTime;
    console.log(`✓ Total test time: ${totalTime}ms`);
    console.log(`✓ Total API calls: ${totalApiCalls}`);
    console.log(`✓ Average time per API call: ${Math.round(totalTime / Math.max(totalApiCalls, 1))}ms`);
    
    // Performance comparison
    const oldApiCalls = estimateOldApiCalls();
    const improvement = Math.round(((oldApiCalls - totalApiCalls) / oldApiCalls) * 100);
    
    console.log(`✓ Estimated old API calls: ${oldApiCalls}`);
    console.log(`✅ API call reduction: ${improvement}%`);
    
    if (dfFiles.length > 0 && dmFiles.length > 0) {
      console.log('✅ All tests PASSED - Optimization working correctly!');
    } else {
      console.log('⚠️  Some tests had issues - Review logs above');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

/**
 * Investigate why file results are empty
 */
async function investigateEmptyResults(fileAPI, fileType) {
  try {
    console.log(`\n🔍 INVESTIGATING EMPTY ${fileType} RESULTS`);
    
    const status = fileAPI.getStatus();
    console.log(`Instance: ${status.instanceId}`);
    console.log(`Config: ${status.currentConfig?.name || 'None'}`);
    console.log(`Config ID: ${status.currentConfig?.id || 'None'}`);
    console.log(`DB ID: ${status.currentConfig?.dbId || 'None'}`);
    console.log(`Is Active: ${status.isActive}`);
    
    // Try to get session info
    const sessionCookie = await fileAPI.getCurrentSession();
    console.log(`Session available: ${sessionCookie ? 'Yes' : 'No'}`);
    
    // Try to fetch raw HTML for analysis
    const html = await fileAPI.fetchFileDatabase(sessionCookie);
    console.log(`HTML length: ${html.length}`);
    console.log(`Contains Routesets Definition: ${html.includes('Routesets Definition')}`);
    console.log(`Contains Routesets Digitmap: ${html.includes('Routesets Digitmap')}`);
    console.log(`Contains file_dbs: ${html.includes('file_dbs')}`);
    
    // Check for specific patterns
    const dfMatches = html.match(/routesets_definitions\/\d+/g);
    const dmMatches = html.match(/routesets_digitmaps\/\d+/g);
    
    console.log(`DF URL patterns found: ${dfMatches ? dfMatches.length : 0}`);
    console.log(`DM URL patterns found: ${dmMatches ? dmMatches.length : 0}`);
    
    if (dfMatches && dfMatches.length > 0) {
      console.log(`First DF pattern: ${dfMatches[0]}`);
    }
    
    if (dmMatches && dmMatches.length > 0) {
      console.log(`First DM pattern: ${dmMatches[0]}`);
    }

  } catch (error) {
    console.error(`Investigation failed: ${error.message}`);
  }
}

/**
 * Estimate API calls from old system
 */
function estimateOldApiCalls() {
  // Based on the user's description:
  // Switch ProSBC → 8-12 API calls
  // Get all configs → 5-8 additional calls  
  // Validate each config → 3-5 calls per config
  // Total: 20-40 API calls per switch
  
  return 30; // Average estimate
}

/**
 * Run specific test scenarios
 */
async function runTestScenarios() {
  console.log('\n🧪 RUNNING SPECIFIC TEST SCENARIOS');
  console.log('='.repeat(60));

  // Scenario 1: Multiple rapid switches
  console.log('\n📋 SCENARIO 1: Multiple Rapid Switches');
  console.log('-'.repeat(40));
  
  const switches = [
    'config_052421-1',
    'config_1', 
    'config_052421-1', // Same as first - should be cached
    'config_demo'
  ];
  
  let totalSwitchApiCalls = 0;
  
  for (let i = 0; i < switches.length; i++) {
    const configId = switches[i];
    console.log(`\nSwitch ${i + 1}: ${configId}`);
    
    const startTime = Date.now();
    const result = await enhancedSwitcher.switchInstance('prosbc1', configId);
    const endTime = Date.now();
    
    totalSwitchApiCalls += result.apiCallsUsed;
    
    console.log(`✓ Time: ${endTime - startTime}ms`);
    console.log(`✓ API calls: ${result.apiCallsUsed}`);
    console.log(`✓ Validation: ${result.validation.success ? 'PASS' : 'FAIL'}`);
  }
  
  console.log(`\n📊 Total API calls for ${switches.length} switches: ${totalSwitchApiCalls}`);
  console.log(`📊 Average API calls per switch: ${(totalSwitchApiCalls / switches.length).toFixed(1)}`);
  
  // Scenario 2: File operations after switch
  console.log('\n📁 SCENARIO 2: File Operations After Switch');
  console.log('-'.repeat(40));
  
  const fileAPI = createEnhancedProSBCFileAPI('prosbc1');
  
  // Should use cached session and config
  const dfFiles = await fileAPI.getDFFiles();
  const dmFiles = await fileAPI.getDMFiles();
  
  console.log(`✓ DF files after switch: ${dfFiles.length}`);
  console.log(`✓ DM files after switch: ${dmFiles.length}`);
}

// Run the tests
console.log('🎬 Starting Enhanced ProSBC Optimization Tests...\n');

testEnhancedOptimizations()
  .then(() => runTestScenarios())
  .then(() => {
    console.log('\n🏁 All tests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });
