// NAP Creation Performance Test Utility
import { createNapWithProSBCWorkflow as originalWorkflow } from './napApiProSBCWorkflow.js';
import { createNapWithProSBCWorkflow as optimizedWorkflow, clearSessionCache } from './napApiProSBCWorkflowOptimized.js';

export class NapPerformanceTest {
  constructor() {
    this.results = [];
  }

  async testOriginalWorkflow(napConfig) {
    console.log('🧪 Testing Original Workflow...');
    const startTime = Date.now();
    
    try {
      const result = await originalWorkflow(napConfig);
      const duration = Date.now() - startTime;
      
      const testResult = {
        workflow: 'original',
        success: result.success,
        duration,
        napId: result.napId,
        message: result.message,
        timestamp: new Date().toISOString()
      };
      
      this.results.push(testResult);
      console.log(`✅ Original workflow completed in ${duration}ms`);
      return testResult;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult = {
        workflow: 'original',
        success: false,
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.results.push(testResult);
      console.log(`❌ Original workflow failed after ${duration}ms:`, error.message);
      return testResult;
    }
  }

  async testOptimizedWorkflow(napConfig) {
    console.log('🚀 Testing Optimized Workflow...');
    const startTime = Date.now();
    
    try {
      const result = await optimizedWorkflow(napConfig);
      const duration = Date.now() - startTime;
      
      const testResult = {
        workflow: 'optimized',
        success: result.success,
        duration,
        napId: result.napId,
        message: result.message,
        executionTime: result.executionTime,
        performanceSteps: result.performanceSteps,
        timestamp: new Date().toISOString()
      };
      
      this.results.push(testResult);
      console.log(`✅ Optimized workflow completed in ${duration}ms`);
      return testResult;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const testResult = {
        workflow: 'optimized',
        success: false,
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.results.push(testResult);
      console.log(`❌ Optimized workflow failed after ${duration}ms:`, error.message);
      return testResult;
    }
  }

  async runComparison(napConfig, iterations = 1) {
    console.log(`🏁 Running NAP creation performance comparison (${iterations} iterations)`);
    
    const originalResults = [];
    const optimizedResults = [];
    
    for (let i = 0; i < iterations; i++) {
      console.log(`\n--- Iteration ${i + 1}/${iterations} ---`);
      
      // Test with unique names to avoid conflicts
      const testConfig = {
        ...napConfig,
        name: `${napConfig.name}_test_${i + 1}_${Date.now()}`
      };
      
      // Clear cache before each test to simulate fresh sessions
      clearSessionCache();
      
      // Test original workflow
      const originalResult = await this.testOriginalWorkflow(testConfig);
      originalResults.push(originalResult);
      
      // Wait a bit between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Clear cache again
      clearSessionCache();
      
      // Test optimized workflow
      const optimizedConfig = {
        ...testConfig,
        name: `${napConfig.name}_opt_${i + 1}_${Date.now()}`
      };
      
      const optimizedResult = await this.testOptimizedWorkflow(optimizedConfig);
      optimizedResults.push(optimizedResult);
      
      // Wait between iterations
      if (i < iterations - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    return this.analyzeResults(originalResults, optimizedResults);
  }

  analyzeResults(originalResults, optimizedResults) {
    const originalSuccess = originalResults.filter(r => r.success);
    const optimizedSuccess = optimizedResults.filter(r => r.success);
    
    const originalAvg = originalSuccess.length > 0 
      ? originalSuccess.reduce((sum, r) => sum + r.duration, 0) / originalSuccess.length
      : 0;
      
    const optimizedAvg = optimizedSuccess.length > 0
      ? optimizedSuccess.reduce((sum, r) => sum + r.duration, 0) / optimizedSuccess.length
      : 0;
    
    const improvement = originalAvg - optimizedAvg;
    const percentImprovement = originalAvg > 0 ? ((improvement / originalAvg) * 100).toFixed(1) : 0;
    
    const analysis = {
      originalWorkflow: {
        totalTests: originalResults.length,
        successfulTests: originalSuccess.length,
        averageDuration: Math.round(originalAvg),
        minDuration: originalSuccess.length > 0 ? Math.min(...originalSuccess.map(r => r.duration)) : 0,
        maxDuration: originalSuccess.length > 0 ? Math.max(...originalSuccess.map(r => r.duration)) : 0,
        failureRate: ((originalResults.length - originalSuccess.length) / originalResults.length * 100).toFixed(1)
      },
      optimizedWorkflow: {
        totalTests: optimizedResults.length,
        successfulTests: optimizedSuccess.length,
        averageDuration: Math.round(optimizedAvg),
        minDuration: optimizedSuccess.length > 0 ? Math.min(...optimizedSuccess.map(r => r.duration)) : 0,
        maxDuration: optimizedSuccess.length > 0 ? Math.max(...optimizedSuccess.map(r => r.duration)) : 0,
        failureRate: ((optimizedResults.length - optimizedSuccess.length) / optimizedResults.length * 100).toFixed(1)
      },
      comparison: {
        improvement,
        percentImprovement: parseFloat(percentImprovement),
        isFaster: improvement > 0,
        speedupFactor: originalAvg > 0 ? (originalAvg / optimizedAvg).toFixed(2) : 0
      },
      rawResults: {
        original: originalResults,
        optimized: optimizedResults
      }
    };
    
    this.printAnalysis(analysis);
    return analysis;
  }

  printAnalysis(analysis) {
    console.log('\n📊 Performance Analysis Results:');
    console.log('=====================================');
    
    console.log('\n🔸 Original Workflow:');
    console.log(`  Success Rate: ${100 - parseFloat(analysis.originalWorkflow.failureRate)}%`);
    console.log(`  Average Duration: ${analysis.originalWorkflow.averageDuration}ms`);
    console.log(`  Range: ${analysis.originalWorkflow.minDuration}ms - ${analysis.originalWorkflow.maxDuration}ms`);
    
    console.log('\n🚀 Optimized Workflow:');
    console.log(`  Success Rate: ${100 - parseFloat(analysis.optimizedWorkflow.failureRate)}%`);
    console.log(`  Average Duration: ${analysis.optimizedWorkflow.averageDuration}ms`);
    console.log(`  Range: ${analysis.optimizedWorkflow.minDuration}ms - ${analysis.optimizedWorkflow.maxDuration}ms`);
    
    console.log('\n⚡ Performance Improvement:');
    if (analysis.comparison.isFaster) {
      console.log(`  🎉 ${analysis.comparison.improvement}ms faster (${analysis.comparison.percentImprovement}% improvement)`);
      console.log(`  📈 Speedup Factor: ${analysis.comparison.speedupFactor}x`);
    } else {
      console.log(`  ⚠️ ${Math.abs(analysis.comparison.improvement)}ms slower (${Math.abs(analysis.comparison.percentImprovement)}% degradation)`);
    }
    
    console.log('\n=====================================');
  }

  getResults() {
    return this.results;
  }

  clearResults() {
    this.results = [];
  }
}

// Global test instance
export const napPerformanceTest = new NapPerformanceTest();

// Quick test function
export const quickPerformanceTest = async (napConfig) => {
  return await napPerformanceTest.runComparison(napConfig, 1);
};
