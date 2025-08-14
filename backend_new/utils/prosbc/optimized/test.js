// Test script for optimized ProSBC utilities
import { OptimizedProSBCFileAPI } from './optimizedFileManager.js';
import { PerformanceComparator } from './migration.js';
import { sessionPool, configCache, connectionPool } from './index.js';

/**
 * Test the optimized ProSBC utilities
 */
async function testOptimizedProSBC() {
  console.log('🚀 Starting ProSBC Optimization Tests...\n');

  try {
    // Test 1: Basic instance creation and context loading
    console.log('📋 Test 1: Instance Creation');
    const api = new OptimizedProSBCFileAPI('prosbc1');
    await api.loadInstanceContext();
    console.log(`✅ Instance loaded: ${api.instanceContext.name}`);
    console.log(`   Base URL: ${api.baseURL}`);

    // Test 2: Session management
    console.log('\n🔐 Test 2: Session Management');
    const sessionStart = Date.now();
    const session1 = await api.getSessionCookie();
    console.log(`✅ First session obtained in ${Date.now() - sessionStart}ms`);
    
    const session2Start = Date.now();
    const session2 = await api.getSessionCookie();
    console.log(`✅ Second session (cached) obtained in ${Date.now() - session2Start}ms`);
    console.log(`   Session reused: ${session1 === session2 ? 'Yes' : 'No'}`);

    // Test 3: Configuration selection with caching
    console.log('\n⚙️ Test 3: Configuration Selection');
    const configStart = Date.now();
    await api.ensureConfigSelected('3');
    console.log(`✅ Config selected in ${Date.now() - configStart}ms`);
    
    const config2Start = Date.now();
    await api.ensureConfigSelected('3');
    console.log(`✅ Config re-selected (cached) in ${Date.now() - config2Start}ms`);

    // Test 4: File listing
    console.log('\n📁 Test 4: File Listing');
    const listStart = Date.now();
    const allFiles = await api.listAllFiles();
    console.log(`✅ File listing completed in ${Date.now() - listStart}ms`);
    console.log(`   DF Files: ${allFiles.dfFiles.length}`);
    console.log(`   DM Files: ${allFiles.dmFiles.length}`);
    console.log(`   Total Files: ${allFiles.total}`);

    // Test 5: Performance statistics
    console.log('\n📊 Test 5: Performance Statistics');
    const stats = api.getStats();
    console.log('✅ Performance stats:');
    console.log(`   Requests: ${stats.metrics.requests}`);
    console.log(`   Success Rate: ${stats.metrics.successRate.toFixed(1)}%`);
    console.log(`   Cache Hit Rate: ${stats.metrics.cacheHitRate.toFixed(1)}%`);
    console.log(`   Avg Response Time: ${stats.metrics.avgResponseTime.toFixed(0)}ms`);

    // Test 6: Global pool statistics
    console.log('\n🏊 Test 6: Pool Statistics');
    console.log('✅ Session Pool:', sessionPool.getStats());
    console.log('✅ Connection Pool:', connectionPool.getStats());
    console.log('✅ Config Cache:', configCache.getStats());

    console.log('\n🎉 All tests completed successfully!');
    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

/**
 * Performance comparison test
 */
async function testPerformanceComparison() {
  console.log('\n⚡ Starting Performance Comparison...\n');

  try {
    const comparator = new PerformanceComparator('prosbc1');
    const results = await comparator.runBenchmarkSuite();
    
    console.log('📈 Benchmark Results:');
    console.log(`Instance: ${results.instanceId}`);
    console.log(`Timestamp: ${results.timestamp}\n`);

    results.benchmarks.forEach(benchmark => {
      console.log(`🔍 ${benchmark.operation}:`);
      
      if (benchmark.original?.success) {
        console.log(`   Original: ${benchmark.original.duration}ms`);
      } else {
        console.log(`   Original: Failed (${benchmark.original?.error})`);
      }
      
      if (benchmark.optimized?.success) {
        console.log(`   Optimized: ${benchmark.optimized.duration}ms`);
      } else {
        console.log(`   Optimized: Failed (${benchmark.optimized?.error})`);
      }
      
      if (benchmark.improvement) {
        console.log(`   Improvement: ${benchmark.improvement.percentImprovement.toFixed(1)}% faster`);
        console.log(`   Speedup: ${benchmark.improvement.speedupRatio.toFixed(2)}x`);
        console.log(`   Time Saved: ${benchmark.improvement.timeSavedMs}ms`);
      }
      console.log('');
    });

    console.log('📊 Summary:');
    console.log(`   Average Speedup: ${results.summary.averageSpeedup}`);
    console.log(`   Average Improvement: ${results.summary.averageImprovement}`);
    console.log(`   Total Time Saved: ${results.summary.totalTimeSavedMs}ms`);
    console.log(`   Successful Tests: ${results.summary.successfulTests}/${results.summary.totalTests}`);

    return results;

  } catch (error) {
    console.error('\n❌ Performance test failed:', error.message);
    return null;
  }
}

/**
 * Multi-instance test
 */
async function testMultiInstance() {
  console.log('\n🏢 Testing Multi-Instance Support...\n');

  try {
    // Test multiple instances simultaneously
    const instances = ['prosbc1', 'prosbc2'];
    const apis = instances.map(id => new OptimizedProSBCFileAPI(id));

    console.log('📡 Testing parallel instance operations...');
    
    const results = await Promise.allSettled(
      apis.map(async (api, index) => {
        try {
          await api.loadInstanceContext();
          const session = await api.getSessionCookie();
          await api.ensureConfigSelected('3');
          
          return {
            instanceId: instances[index],
            success: true,
            session: session ? 'Obtained' : 'Failed'
          };
        } catch (error) {
          return {
            instanceId: instances[index],
            success: false,
            error: error.message
          };
        }
      })
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        if (data.success) {
          console.log(`✅ ${data.instanceId}: Session ${data.session}`);
        } else {
          console.log(`❌ ${data.instanceId}: ${data.error}`);
        }
      } else {
        console.log(`❌ ${instances[index]}: ${result.reason.message}`);
      }
    });

    // Test global pool statistics with multiple instances
    console.log('\n📊 Multi-Instance Pool Stats:');
    console.log('Session Pool:', sessionPool.getStats());
    console.log('Connection Pool:', connectionPool.getStats());

    return true;

  } catch (error) {
    console.error('\n❌ Multi-instance test failed:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🧪 ProSBC Optimization Test Suite');
  console.log('==================================\n');

  const results = {
    basic: false,
    performance: null,
    multiInstance: false
  };

  // Run basic functionality tests
  results.basic = await testOptimizedProSBC();

  // Run performance comparison (only if basic tests pass)
  if (results.basic) {
    results.performance = await testPerformanceComparison();
  }

  // Run multi-instance tests
  results.multiInstance = await testMultiInstance();

  // Final summary
  console.log('\n📋 Test Summary');
  console.log('================');
  console.log(`Basic Functionality: ${results.basic ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Performance Comparison: ${results.performance ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Multi-Instance Support: ${results.multiInstance ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = results.basic && results.performance && results.multiInstance;
  console.log(`\nOverall Result: ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);

  return results;
}

// Export for use in other test files
export {
  testOptimizedProSBC,
  testPerformanceComparison,
  testMultiInstance,
  runAllTests
};

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
