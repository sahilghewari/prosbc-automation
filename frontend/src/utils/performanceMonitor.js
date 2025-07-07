// Performance monitoring utility for NAP creation workflow
export class NapPerformanceMonitor {
  constructor() {
    this.metrics = [];
    this.currentOperation = null;
  }

  startOperation(name, details = {}) {
    this.currentOperation = {
      name,
      details,
      startTime: Date.now(),
      steps: []
    };
    console.log(`🚀 Starting operation: ${name}`);
  }

  addStep(stepName, duration = null) {
    if (!this.currentOperation) return;
    
    const now = Date.now();
    const stepDuration = duration || (now - (this.currentOperation.lastStepTime || this.currentOperation.startTime));
    
    this.currentOperation.steps.push({
      name: stepName,
      duration: stepDuration,
      timestamp: now
    });
    
    this.currentOperation.lastStepTime = now;
    console.log(`📊 Step: ${stepName} - ${stepDuration}ms`);
  }

  finishOperation(success = true, result = null) {
    if (!this.currentOperation) return null;
    
    const totalDuration = Date.now() - this.currentOperation.startTime;
    
    const metric = {
      ...this.currentOperation,
      totalDuration,
      success,
      result,
      finishedAt: Date.now()
    };
    
    this.metrics.push(metric);
    
    console.log(`✅ Operation completed: ${this.currentOperation.name} - ${totalDuration}ms (${success ? 'Success' : 'Failed'})`);
    
    this.currentOperation = null;
    return metric;
  }

  getMetrics() {
    return this.metrics;
  }

  getAverageTime(operationName = null) {
    const relevantMetrics = operationName 
      ? this.metrics.filter(m => m.name === operationName && m.success)
      : this.metrics.filter(m => m.success);
      
    if (relevantMetrics.length === 0) return 0;
    
    const total = relevantMetrics.reduce((sum, m) => sum + m.totalDuration, 0);
    return Math.round(total / relevantMetrics.length);
  }

  getLastOperationTime() {
    if (this.metrics.length === 0) return 0;
    return this.metrics[this.metrics.length - 1].totalDuration;
  }

  printSummary() {
    console.log('📊 NAP Creation Performance Summary:');
    console.log(`Total operations: ${this.metrics.length}`);
    console.log(`Successful operations: ${this.metrics.filter(m => m.success).length}`);
    console.log(`Average time: ${this.getAverageTime()}ms`);
    console.log(`Last operation: ${this.getLastOperationTime()}ms`);
    
    if (this.metrics.length > 1) {
      const recentAvg = this.metrics.slice(-5).reduce((sum, m) => sum + m.totalDuration, 0) / Math.min(5, this.metrics.length);
      console.log(`Recent average (last 5): ${Math.round(recentAvg)}ms`);
    }
  }

  clearMetrics() {
    this.metrics = [];
    console.log('🗑️ Performance metrics cleared');
  }
}

// Global instance
export const napPerformanceMonitor = new NapPerformanceMonitor();

// Performance comparison utility
export const comparePerformance = (oldTime, newTime) => {
  const improvement = oldTime - newTime;
  const percentImprovement = ((improvement / oldTime) * 100).toFixed(1);
  
  if (improvement > 0) {
    console.log(`🎉 Performance improved by ${improvement}ms (${percentImprovement}% faster)`);
  } else {
    console.log(`⚠️ Performance degraded by ${Math.abs(improvement)}ms (${Math.abs(percentImprovement)}% slower)`);
  }
  
  return {
    oldTime,
    newTime,
    improvement,
    percentImprovement: parseFloat(percentImprovement),
    isFaster: improvement > 0
  };
};
