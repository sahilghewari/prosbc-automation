// Enhanced Performance Analytics for NAP Creation
// Provides detailed metrics, comparison tools, and optimization insights

import { napPerformanceMonitor } from './performanceMonitor.js';

export class NapPerformanceAnalytics {
  constructor() {
    this.sessionMetrics = [];
    this.baselineMetrics = null;
  }

  // Record a complete NAP creation session
  recordSession(sessionData) {
    const session = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...sessionData,
      calculatedMetrics: this.calculateMetrics(sessionData)
    };
    
    this.sessionMetrics.push(session);
    return session;
  }

  // Calculate additional metrics from session data
  calculateMetrics(sessionData) {
    const metrics = {};
    
    if (sessionData.steps && sessionData.steps.length > 0) {
      metrics.totalSteps = sessionData.steps.length;
      metrics.avgStepTime = sessionData.steps.reduce((sum, step) => sum + step.duration, 0) / sessionData.steps.length;
      metrics.longestStep = Math.max(...sessionData.steps.map(s => s.duration));
      metrics.shortestStep = Math.min(...sessionData.steps.map(s => s.duration));
      
      // Identify bottlenecks (steps taking >30% of total time)
      const bottlenecks = sessionData.steps.filter(step => 
        step.duration > (sessionData.totalDuration * 0.3)
      );
      metrics.bottlenecks = bottlenecks.map(step => step.name);
      
      // Calculate efficiency score (lower is better)
      const overhead = sessionData.totalDuration - sessionData.steps.reduce((sum, step) => sum + step.duration, 0);
      metrics.efficiencyScore = Math.max(0, 100 - (overhead / sessionData.totalDuration * 100));
    }
    
    return metrics;
  }

  // Set baseline metrics for comparison
  setBaseline(workflowName = 'original') {
    const baselineSessions = this.sessionMetrics.filter(s => s.workflowType === workflowName);
    
    if (baselineSessions.length > 0) {
      this.baselineMetrics = {
        workflowName,
        avgDuration: baselineSessions.reduce((sum, s) => sum + s.totalDuration, 0) / baselineSessions.length,
        minDuration: Math.min(...baselineSessions.map(s => s.totalDuration)),
        maxDuration: Math.max(...baselineSessions.map(s => s.totalDuration)),
        successRate: (baselineSessions.filter(s => s.success).length / baselineSessions.length) * 100,
        sampleSize: baselineSessions.length
      };
    }
    
    return this.baselineMetrics;
  }

  // Compare current performance against baseline
  compareWithBaseline(currentSessions) {
    if (!this.baselineMetrics) {
      return null;
    }
    
    const currentMetrics = {
      avgDuration: currentSessions.reduce((sum, s) => sum + s.totalDuration, 0) / currentSessions.length,
      minDuration: Math.min(...currentSessions.map(s => s.totalDuration)),
      maxDuration: Math.max(...currentSessions.map(s => s.totalDuration)),
      successRate: (currentSessions.filter(s => s.success).length / currentSessions.length) * 100,
      sampleSize: currentSessions.length
    };
    
    const improvement = this.baselineMetrics.avgDuration - currentMetrics.avgDuration;
    const percentImprovement = (improvement / this.baselineMetrics.avgDuration) * 100;
    
    return {
      baseline: this.baselineMetrics,
      current: currentMetrics,
      improvement: {
        absoluteMs: improvement,
        percentImprovement: percentImprovement.toFixed(1),
        isBetter: improvement > 0
      }
    };
  }

  // Generate comprehensive performance report
  generateReport() {
    const report = {
      generatedAt: new Date().toISOString(),
      totalSessions: this.sessionMetrics.length,
      successful: this.sessionMetrics.filter(s => s.success).length,
      failed: this.sessionMetrics.filter(s => !s.success).length,
      workflowBreakdown: {},
      performance: {},
      insights: []
    };
    
    // Workflow breakdown
    const workflowTypes = [...new Set(this.sessionMetrics.map(s => s.workflowType))];
    workflowTypes.forEach(type => {
      const sessions = this.sessionMetrics.filter(s => s.workflowType === type);
      report.workflowBreakdown[type] = {
        sessions: sessions.length,
        avgDuration: sessions.reduce((sum, s) => sum + s.totalDuration, 0) / sessions.length,
        successRate: (sessions.filter(s => s.success).length / sessions.length) * 100
      };
    });
    
    // Performance metrics
    if (this.sessionMetrics.length > 0) {
      const allDurations = this.sessionMetrics.map(s => s.totalDuration);
      report.performance = {
        avgDuration: allDurations.reduce((sum, d) => sum + d, 0) / allDurations.length,
        minDuration: Math.min(...allDurations),
        maxDuration: Math.max(...allDurations),
        standardDeviation: this.calculateStandardDeviation(allDurations)
      };
    }
    
    // Generate insights
    report.insights = this.generateInsights();
    
    return report;
  }

  // Calculate standard deviation
  calculateStandardDeviation(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
    return Math.sqrt(avgSquaredDiff);
  }

  // Generate performance insights
  generateInsights() {
    const insights = [];
    
    if (this.sessionMetrics.length === 0) {
      return ['No performance data available'];
    }
    
    // Success rate insight
    const successRate = (this.sessionMetrics.filter(s => s.success).length / this.sessionMetrics.length) * 100;
    if (successRate < 90) {
      insights.push(`Low success rate (${successRate.toFixed(1)}%) - investigate error patterns`);
    } else if (successRate >= 95) {
      insights.push(`Excellent success rate (${successRate.toFixed(1)}%)`);
    }
    
    // Performance consistency
    const durations = this.sessionMetrics.map(s => s.totalDuration);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const stdDev = this.calculateStandardDeviation(durations);
    const variability = (stdDev / avgDuration) * 100;
    
    if (variability > 50) {
      insights.push(`High performance variability (${variability.toFixed(1)}%) - optimize for consistency`);
    } else if (variability < 20) {
      insights.push(`Good performance consistency (${variability.toFixed(1)}% variation)`);
    }
    
    // Bottleneck analysis
    const allBottlenecks = this.sessionMetrics
      .filter(s => s.calculatedMetrics && s.calculatedMetrics.bottlenecks)
      .flatMap(s => s.calculatedMetrics.bottlenecks);
    
    if (allBottlenecks.length > 0) {
      const bottleneckCounts = allBottlenecks.reduce((counts, bottleneck) => {
        counts[bottleneck] = (counts[bottleneck] || 0) + 1;
        return counts;
      }, {});
      
      const mostCommonBottleneck = Object.entries(bottleneckCounts)
        .sort(([, a], [, b]) => b - a)[0];
      
      insights.push(`Most common bottleneck: ${mostCommonBottleneck[0]} (${mostCommonBottleneck[1]} occurrences)`);
    }
    
    // Comparison with baseline
    if (this.baselineMetrics) {
      const recentSessions = this.sessionMetrics.slice(-5);
      const comparison = this.compareWithBaseline(recentSessions);
      
      if (comparison && comparison.improvement.isBetter) {
        insights.push(`Recent performance improved by ${comparison.improvement.percentImprovement}% vs baseline`);
      }
    }
    
    return insights;
  }

  // Export data for external analysis
  exportData() {
    return {
      sessions: this.sessionMetrics,
      baseline: this.baselineMetrics,
      report: this.generateReport(),
      exportedAt: new Date().toISOString()
    };
  }

  // Clear all metrics
  clearAllMetrics() {
    this.sessionMetrics = [];
    this.baselineMetrics = null;
    napPerformanceMonitor.clearMetrics();
  }

  // Print detailed console report
  printDetailedReport() {
    const report = this.generateReport();
    
    console.log('\n📊 NAP Performance Analytics Report');
    console.log('=====================================');
    console.log(`Generated: ${report.generatedAt}`);
    console.log(`Total Sessions: ${report.totalSessions}`);
    console.log(`Successful: ${report.successful} (${((report.successful / report.totalSessions) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${report.failed}`);
    
    if (Object.keys(report.workflowBreakdown).length > 1) {
      console.log('\n🔀 Workflow Comparison:');
      Object.entries(report.workflowBreakdown).forEach(([type, data]) => {
        console.log(`  ${type}: ${data.avgDuration.toFixed(0)}ms avg (${data.successRate.toFixed(1)}% success)`);
      });
    }
    
    if (report.performance.avgDuration) {
      console.log('\n⚡ Performance Metrics:');
      console.log(`  Average: ${report.performance.avgDuration.toFixed(0)}ms`);
      console.log(`  Range: ${report.performance.minDuration}ms - ${report.performance.maxDuration}ms`);
      console.log(`  Std Dev: ${report.performance.standardDeviation.toFixed(0)}ms`);
    }
    
    if (report.insights.length > 0) {
      console.log('\n💡 Insights:');
      report.insights.forEach(insight => {
        console.log(`  • ${insight}`);
      });
    }
    
    return report;
  }
}

// Global analytics instance
export const napAnalytics = new NapPerformanceAnalytics();

// Utility functions for easy access
export const recordNapSession = (sessionData) => napAnalytics.recordSession(sessionData);
export const setPerformanceBaseline = (workflowName) => napAnalytics.setBaseline(workflowName);
export const printPerformanceReport = () => napAnalytics.printDetailedReport();
export const exportPerformanceData = () => napAnalytics.exportData();
export const clearPerformanceData = () => napAnalytics.clearAllMetrics();
