import { ComprehensiveQASystem } from './comprehensiveQA';
import { AdvancedPenetrationTesting } from './advancedPenetrationTesting';
import { EnterpriseQAFramework } from './enterpriseQAFramework';

interface LiveTestResults {
  comprehensive: any;
  penetration: any;
  enterprise: any;
  summary: {
    total_tests: number;
    passed: number;
    failed: number;
    warnings: number;
    critical: number;
    overall_score: number;
    security_score: number;
    performance_score: number;
  };
}

export class LiveQAExecution {
  private comprehensive: ComprehensiveQASystem;
  private penetration: AdvancedPenetrationTesting;
  private enterprise: EnterpriseQAFramework;

  constructor(toast?: (options: any) => void) {
    this.comprehensive = new ComprehensiveQASystem(toast);
    this.penetration = new AdvancedPenetrationTesting(toast);
    this.enterprise = new EnterpriseQAFramework();
  }

  async executeCompleteQA(): Promise<LiveTestResults> {
    console.log('🚀 Starting Complete Live QA Execution...');
    
    const results: LiveTestResults = {
      comprehensive: null,
      penetration: null,
      enterprise: null,
      summary: {
        total_tests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        critical: 0,
        overall_score: 0,
        security_score: 0,
        performance_score: 0
      }
    };

    try {
      // Execute comprehensive QA
      console.log('📊 Running Comprehensive QA System...');
      results.comprehensive = await this.comprehensive.runFullQA();
      
      // Execute penetration testing
      console.log('🔍 Running Advanced Penetration Testing...');
      results.penetration = await this.penetration.runFullPenetrationTest();
      
      // Execute enterprise framework
      console.log('⚡ Running Enterprise QA Framework...');
      const performanceBenchmarks = await this.enterprise.runPerformanceBenchmarks();
      const securityAudits = await this.enterprise.runSecurityAudit();
      const concurrencyTests = await this.enterprise.runConcurrencyTests();
      
      results.enterprise = {
        performance: performanceBenchmarks,
        security: securityAudits,
        concurrency: concurrencyTests
      };

      // Calculate comprehensive summary
      results.summary = this.calculateFinalSummary(results);
      
      console.log('✅ Complete QA Execution Finished');
      console.log(`📈 Overall Score: ${results.summary.overall_score}/100`);
      
      return results;
    } catch (error) {
      console.error('❌ QA Execution Failed:', error);
      throw error;
    }
  }

  private calculateFinalSummary(results: LiveTestResults) {
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalWarnings = 0;
    let totalCritical = 0;

    // Aggregate comprehensive results
    if (results.comprehensive?.summary) {
      totalTests += results.comprehensive.summary.total;
      totalPassed += results.comprehensive.summary.passed;
      totalFailed += results.comprehensive.summary.failed;
      totalWarnings += results.comprehensive.summary.warnings;
    }

    // Aggregate penetration results
    if (results.penetration?.summary) {
      totalTests += results.penetration.summary.total;
      totalPassed += results.penetration.summary.passed;
      totalFailed += results.penetration.summary.failed;
      totalWarnings += results.penetration.summary.warnings;
      totalCritical += results.penetration.summary.critical;
    }

    // Calculate scores
    const overallScore = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;
    const securityScore = results.penetration?.summary?.security_score || 0;
    const performanceScore = this.calculatePerformanceScore(results.enterprise?.performance || []);

    return {
      total_tests: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      warnings: totalWarnings,
      critical: totalCritical,
      overall_score: overallScore,
      security_score: securityScore,
      performance_score: performanceScore
    };
  }

  private calculatePerformanceScore(benchmarks: any[]): number {
    if (benchmarks.length === 0) return 0;
    
    const avgSuccessRate = benchmarks.reduce((sum, b) => sum + (b.successRate || 0), 0) / benchmarks.length;
    return Math.round(avgSuccessRate);
  }

  async generateDetailedReport(): Promise<string> {
    const results = await this.executeCompleteQA();
    
    let report = `# 🔬 Live QA Execution Report\n\n`;
    report += `**Execution Date:** ${new Date().toISOString()}\n`;
    report += `**Overall Score:** ${results.summary.overall_score}/100\n`;
    report += `**Security Score:** ${results.summary.security_score}/100\n`;
    report += `**Performance Score:** ${results.summary.performance_score}/100\n\n`;
    
    report += `## Summary Statistics\n`;
    report += `- **Total Tests:** ${results.summary.total_tests}\n`;
    report += `- **Passed:** ${results.summary.passed}\n`;
    report += `- **Failed:** ${results.summary.failed}\n`;
    report += `- **Warnings:** ${results.summary.warnings}\n`;
    report += `- **Critical Issues:** ${results.summary.critical}\n\n`;
    
    // Comprehensive QA Results
    if (results.comprehensive) {
      report += `## Comprehensive QA Results\n`;
      ['security', 'reliability', 'performance', 'usability', 'edge_cases'].forEach(category => {
        if (results.comprehensive[category]) {
          report += `### ${category.toUpperCase()}\n`;
          results.comprehensive[category].forEach((test: any) => {
            const status = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⚠️';
            report += `- ${status} **${test.test}:** ${test.message}\n`;
          });
          report += '\n';
        }
      });
    }
    
    // Penetration Testing Results
    if (results.penetration) {
      report += `## Security Penetration Testing\n`;
      ['security_penetration', 'stress_testing', 'chaos_engineering'].forEach(category => {
        if (results.penetration[category]) {
          report += `### ${category.replace('_', ' ').toUpperCase()}\n`;
          results.penetration[category].forEach((test: any) => {
            const status = test.status === 'pass' ? '✅' : test.status === 'critical' ? '🚨' : test.status === 'fail' ? '❌' : '⚠️';
            const severity = test.severity === 'critical' ? '🔴' : test.severity === 'high' ? '🟠' : test.severity === 'medium' ? '🟡' : '🟢';
            report += `- ${status} ${severity} **${test.test}:** ${test.message}\n`;
          });
          report += '\n';
        }
      });
    }
    
    // Enterprise Framework Results
    if (results.enterprise) {
      report += `## Enterprise Framework Results\n`;
      
      if (results.enterprise.performance) {
        report += `### Performance Benchmarks\n`;
        results.enterprise.performance.forEach((benchmark: any) => {
          report += `- **${benchmark.name}:**\n`;
          report += `  - Average Time: ${benchmark.averageTime?.toFixed(2) || 'N/A'}ms\n`;
          report += `  - Success Rate: ${benchmark.successRate?.toFixed(1) || 'N/A'}%\n`;
          report += `  - Throughput: ${benchmark.throughput?.toFixed(2) || 'N/A'} ops/sec\n`;
        });
        report += '\n';
      }
      
      if (results.enterprise.security) {
        report += `### Security Audits\n`;
        results.enterprise.security.forEach((audit: any) => {
          const severity = audit.severity === 'critical' ? '🔴' : audit.severity === 'high' ? '🟠' : audit.severity === 'medium' ? '🟡' : '🟢';
          report += `- ${severity} **${audit.vulnerability}:** ${audit.description}\n`;
        });
        report += '\n';
      }
    }
    
    report += `## Production Readiness Assessment\n`;
    const readiness = results.summary.overall_score >= 90 && results.summary.critical === 0;
    report += `**Status:** ${readiness ? '✅ PRODUCTION READY' : '⚠️ NEEDS ATTENTION'}\n`;
    report += `**Recommendation:** ${readiness ? 'Approved for deployment' : 'Address critical issues before deployment'}\n\n`;
    
    return report;
  }
}

// Factory function instead of singleton to avoid hook violations
export function createLiveQA(toast?: (options: any) => void) {
  return new LiveQAExecution(toast);
}