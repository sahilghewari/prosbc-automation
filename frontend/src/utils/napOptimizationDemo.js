// NAP Optimization Demo Script
// This script demonstrates the performance improvements in NAP creation

import { NapPerformanceTest } from './napPerformanceTest.js';
import { napPerformanceMonitor } from './performanceMonitor.js';
import { clearSessionCache } from './napApiProSBCWorkflowOptimized.js';

// Sample NAP configuration for testing
const sampleNapConfig = {
  name: 'PERF_TEST_NAP',
  enabled: true,
  profile_id: '1',
  sip_destination_ip: '192.168.1.100',
  sip_destination_port: '5060',
  filter_by_proxy_port: true,
  poll_remote_proxy: true,
  proxy_polling_interval: '1',
  proxy_polling_interval_unit: '60000.0',
  accept_only_authorized_users: false,
  register_to_proxy: false,
  aor: '',
  sip_auth_ignore_realm: false,
  sip_auth_reuse_challenge: false,
  sip_auth_realm: '',
  sip_auth_user: '',
  sip_auth_pass: '',
  remote_nat_rtp: '0',
  remote_nat_sip: '0',
  local_nat_rtp: '',
  local_nat_sip: '',
  sipi_enable: false,
  isup_protocol_variant: '5',
  sipi_version: 'itu-t',
  sipi_use_info_progress: '0',
  append_trailing_f: false,
  poll_proxy_ping_quirk: true,
  response_timeout: '12',
  response_timeout_unit: '1000.0',
  max_forwards: '1',
  sip_183_call_progress: false,
  privacy_type: '3',
  rate_limit_cps: '0',
  rate_limit_cps_in: '0',
  rate_limit_cps_out: '0',
  max_incoming_calls: '0',
  max_outgoing_calls: '0',
  max_total_calls: '0',
  delay_low_threshold: '3',
  delay_low_unit: '1.0',
  delay_high_threshold: '6',
  delay_high_unit: '1.0',
  congestion_nb_calls: '1',
  congestion_period: '1',
  congestion_period_unit: '1.0',
  sip_servers: ['2', '3'],
  port_ranges: ['3', '4']
};

// Demo class for showcasing the optimization
export class NapOptimizationDemo {
  constructor() {
    this.performanceTest = new NapPerformanceTest();
  }

  async runQuickDemo() {
    console.log('🎯 NAP Creation Optimization Demo');
    console.log('==================================');
    
    // Clear any existing session cache
    clearSessionCache();
    
    const testConfig = {
      ...sampleNapConfig,
      name: `DEMO_${Date.now()}`
    };
    
    console.log('📊 Testing optimized workflow...');
    const result = await this.performanceTest.testOptimizedWorkflow(testConfig);
    
    if (result.success) {
      console.log('✅ Demo completed successfully!');
      console.log(`🚀 Creation time: ${result.duration}ms`);
      console.log(`📈 NAP ID: ${result.napId}`);
      
      if (result.performanceSteps) {
        console.log('\n🔍 Performance breakdown:');
        result.performanceSteps.forEach((step, index) => {
          console.log(`  ${index + 1}. ${step.name}: ${step.duration}ms`);
        });
      }
    } else {
      console.log('❌ Demo failed:', result.error);
    }
    
    return result;
  }

  async runFullComparison() {
    console.log('🏁 Full Performance Comparison');
    console.log('===============================');
    
    const testConfig = {
      ...sampleNapConfig,
      name: `COMP_${Date.now()}`
    };
    
    try {
      const results = await this.performanceTest.runComparison(testConfig, 1);
      
      if (results.original && results.optimized) {
        const improvement = results.original.duration - results.optimized.duration;
        const percentImprovement = ((improvement / results.original.duration) * 100).toFixed(1);
        
        console.log('\n📊 Performance Comparison Results:');
        console.log(`Original workflow: ${results.original.duration}ms`);
        console.log(`Optimized workflow: ${results.optimized.duration}ms`);
        console.log(`Improvement: ${improvement}ms (${percentImprovement}% faster)`);
        
        // Show performance monitor summary
        napPerformanceMonitor.printSummary();
        
        return {
          original: results.original.duration,
          optimized: results.optimized.duration,
          improvement,
          percentImprovement
        };
      }
    } catch (error) {
      console.error('❌ Comparison failed:', error);
      return null;
    }
  }

  async runBatchTest(iterations = 3) {
    console.log(`🔄 Running batch test with ${iterations} iterations`);
    console.log('================================================');
    
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      console.log(`\n--- Iteration ${i + 1}/${iterations} ---`);
      
      // Clear cache between tests to simulate fresh sessions
      if (i > 0) {
        clearSessionCache();
      }
      
      const testConfig = {
        ...sampleNapConfig,
        name: `BATCH_${i + 1}_${Date.now()}`
      };
      
      const result = await this.performanceTest.testOptimizedWorkflow(testConfig);
      results.push(result);
      
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Calculate statistics
    const successfulResults = results.filter(r => r.success);
    const totalTime = successfulResults.reduce((sum, r) => sum + r.duration, 0);
    const avgTime = successfulResults.length > 0 ? Math.round(totalTime / successfulResults.length) : 0;
    const minTime = Math.min(...successfulResults.map(r => r.duration));
    const maxTime = Math.max(...successfulResults.map(r => r.duration));
    
    console.log('\n📊 Batch Test Results:');
    console.log(`Total iterations: ${iterations}`);
    console.log(`Successful: ${successfulResults.length}`);
    console.log(`Average time: ${avgTime}ms`);
    console.log(`Min time: ${minTime}ms`);
    console.log(`Max time: ${maxTime}ms`);
    console.log(`Success rate: ${((successfulResults.length / iterations) * 100).toFixed(1)}%`);
    
    return {
      totalIterations: iterations,
      successful: successfulResults.length,
      avgTime,
      minTime,
      maxTime,
      successRate: (successfulResults.length / iterations) * 100
    };
  }

  // Helper method to demonstrate key optimization features
  demonstrateOptimizations() {
    console.log('🔧 Key Optimization Features:');
    console.log('==============================');
    console.log('1. Session Caching: Reuses authenticated sessions across NAP creations');
    console.log('2. CSRF Token Caching: Caches authentication tokens for 30 minutes');
    console.log('3. Smart Navigation: Reduces redundant page loads');
    console.log('4. Parallel Processing: Adds SIP servers and port ranges concurrently');
    console.log('5. Quick Auth Check: Fast authentication validation');
    console.log('6. Optimized Error Handling: Graceful fallback mechanisms');
    console.log('7. Performance Monitoring: Built-in timing and step tracking');
    console.log('8. Timeout Optimization: Reduced timeout values for faster failure detection');
    console.log('\n🎯 Expected Improvements:');
    console.log('- 40-60% faster NAP creation');
    console.log('- Reduced network requests');
    console.log('- Better error recovery');
    console.log('- Detailed performance metrics');
  }
}

// Usage examples
export const runDemo = async () => {
  const demo = new NapOptimizationDemo();
  
  console.log('🚀 Starting NAP Optimization Demo...\n');
  
  // Show optimization features
  demo.demonstrateOptimizations();
  
  // Run a quick demo
  console.log('\n🎯 Running Quick Demo:');
  await demo.runQuickDemo();
  
  // Optional: Run full comparison (uncomment if needed)
  // console.log('\n🏁 Running Full Comparison:');
  // await demo.runFullComparison();
  
  console.log('\n✅ Demo completed!');
};

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.napOptimizationDemo = new NapOptimizationDemo();
  window.runNapDemo = runDemo;
}
