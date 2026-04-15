import { performance } from 'perf_hooks';
import { logger } from './logger';

export interface BenchmarkResult {
  name: string;
  duration: number;
  operations: number;
  opsPerSecond: number;
  memoryUsage: {
    before: NodeJS.MemoryUsage;
    after: NodeJS.MemoryUsage;
    delta: NodeJS.MemoryUsage;
  };
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface BenchmarkSuite {
  name: string;
  benchmarks: BenchmarkResult[];
  totalDuration: number;
  averageOpsPerSecond: number;
  timestamp: number;
}

class BenchmarkRunner {
  private static instance: BenchmarkRunner;
  private suites = new Map<string, BenchmarkSuite>();

  private constructor() {}

  static getInstance(): BenchmarkRunner {
    if (!BenchmarkRunner.instance) {
      BenchmarkRunner.instance = new BenchmarkRunner();
    }
    return BenchmarkRunner.instance;
  }

  async runBenchmark(
    name: string,
    operation: () => Promise<void> | void,
    options: {
      iterations?: number;
      warmupIterations?: number;
      memoryTracking?: boolean;
    } = {}
  ): Promise<BenchmarkResult> {
    const {
      iterations = 1000,
      warmupIterations = 100,
      memoryTracking = true
    } = options;

    logger.info(`Starting benchmark: ${name}`, { iterations, warmupIterations });

    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await operation();
    }

    // Memory tracking
    const memBefore = memoryTracking ? process.memoryUsage() : ({} as NodeJS.MemoryUsage);

    // Actual benchmark
    const startTime = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await operation();
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const memAfter = memoryTracking ? process.memoryUsage() : ({} as NodeJS.MemoryUsage);
    const memDelta = memoryTracking ? {
      rss: memAfter.rss - memBefore.rss,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      external: memAfter.external - memBefore.external,
      arrayBuffers: memAfter.arrayBuffers - memBefore.arrayBuffers
    } : ({} as NodeJS.MemoryUsage);

    const result: BenchmarkResult = {
      name,
      duration,
      operations: iterations,
      opsPerSecond: (iterations / duration) * 1000,
      memoryUsage: {
        before: memBefore,
        after: memAfter,
        delta: memDelta
      },
      timestamp: Date.now(),
      metadata: {
        iterations,
        warmupIterations,
        memoryTracking
      }
    };

    logger.info(`Benchmark completed: ${name}`, {
      duration: `${duration.toFixed(2)}ms`,
      opsPerSecond: result.opsPerSecond.toFixed(2),
      memoryDelta: `${(memDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`
    });

    return result;
  }

  async runSuite(
    suiteName: string,
    benchmarks: Array<{
      name: string;
      operation: () => Promise<void> | void;
      options?: any;
    }>
  ): Promise<BenchmarkSuite> {
    logger.info(`Starting benchmark suite: ${suiteName}`, { count: benchmarks.length });

    const results: BenchmarkResult[] = [];
    let totalDuration = 0;

    for (const benchmark of benchmarks) {
      const result = await this.runBenchmark(benchmark.name, benchmark.operation, benchmark.options);
      results.push(result);
      totalDuration += result.duration;
    }

    const averageOpsPerSecond = results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length;

    const suite: BenchmarkSuite = {
      name: suiteName,
      benchmarks: results,
      totalDuration,
      averageOpsPerSecond,
      timestamp: Date.now()
    };

    this.suites.set(suiteName, suite);

    logger.info(`Benchmark suite completed: ${suiteName}`, {
      totalDuration: `${totalDuration.toFixed(2)}ms`,
      averageOpsPerSecond: averageOpsPerSecond.toFixed(2)
    });

    return suite;
  }

  getSuite(name: string): BenchmarkSuite | undefined {
    return this.suites.get(name);
  }

  getAllSuites(): BenchmarkSuite[] {
    return Array.from(this.suites.values());
  }

  compareResults(result1: BenchmarkResult, result2: BenchmarkResult): {
    faster: 'result1' | 'result2';
    speedup: number;
    durationDiff: number;
    opsPerSecondDiff: number;
    memoryDiff: NodeJS.MemoryUsage;
  } {
    const speedup = result2.opsPerSecond / result1.opsPerSecond;
    const faster = speedup > 1 ? 'result2' : 'result1';
    const actualSpeedup = faster === 'result2' ? speedup : 1 / speedup;

    return {
      faster,
      speedup: actualSpeedup,
      durationDiff: result2.duration - result1.duration,
      opsPerSecondDiff: result2.opsPerSecond - result1.opsPerSecond,
      memoryDiff: {
        rss: result2.memoryUsage.delta.rss - result1.memoryUsage.delta.rss,
        heapTotal: result2.memoryUsage.delta.heapTotal - result1.memoryUsage.delta.heapTotal,
        heapUsed: result2.memoryUsage.delta.heapUsed - result1.memoryUsage.delta.heapUsed,
        external: result2.memoryUsage.delta.external - result1.memoryUsage.delta.external,
        arrayBuffers: result2.memoryUsage.delta.arrayBuffers - result1.memoryUsage.delta.arrayBuffers
      }
    };
  }

  generateReport(suiteName: string): string {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      throw new Error(`Benchmark suite '${suiteName}' not found`);
    }

    let report = `# Benchmark Suite: ${suite.name}\n\n`;
    report += `**Timestamp:** ${new Date(suite.timestamp).toISOString()}\n`;
    report += `**Total Duration:** ${suite.totalDuration.toFixed(2)}ms\n`;
    report += `**Average Ops/sec:** ${suite.averageOpsPerSecond.toFixed(2)}\n\n`;

    report += `## Results\n\n`;
    report += `| Benchmark | Duration (ms) | Ops/sec | Memory (MB) |\n`;
    report += `|-----------|---------------|---------|------------|\n`;

    for (const result of suite.benchmarks) {
      const memoryMB = result.memoryUsage.delta.heapUsed / 1024 / 1024;
      report += `| ${result.name} | ${result.duration.toFixed(2)} | ${result.opsPerSecond.toFixed(2)} | ${memoryMB.toFixed(2)} |\n`;
    }

    // Find fastest and slowest
    const fastest = suite.benchmarks.reduce((min, r) => r.opsPerSecond > min.opsPerSecond ? r : min);
    const slowest = suite.benchmarks.reduce((max, r) => r.opsPerSecond < max.opsPerSecond ? r : max);

    report += `\n## Summary\n\n`;
    report += `**Fastest:** ${fastest.name} (${fastest.opsPerSecond.toFixed(2)} ops/sec)\n`;
    report += `**Slowest:** ${slowest.name} (${slowest.opsPerSecond.toFixed(2)} ops/sec)\n`;
    report += `**Speedup:** ${(fastest.opsPerSecond / slowest.opsPerSecond).toFixed(2)}x\n`;

    return report;
  }

  exportResults(suiteName: string, format: 'json' | 'csv' = 'json'): string {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      throw new Error(`Benchmark suite '${suiteName}' not found`);
    }

    if (format === 'json') {
      return JSON.stringify(suite, null, 2);
    } else if (format === 'csv') {
      let csv = 'Benchmark,Duration(ms),Ops/sec,MemoryBefore(MB),MemoryAfter(MB),MemoryDelta(MB)\n';
      
      for (const result of suite.benchmarks) {
        const memBeforeMB = result.memoryUsage.before.heapUsed / 1024 / 1024;
        const memAfterMB = result.memoryUsage.after.heapUsed / 1024 / 1024;
        const memDeltaMB = result.memoryUsage.delta.heapUsed / 1024 / 1024;
        
        csv += `${result.name},${result.duration},${result.opsPerSecond},${memBeforeMB},${memAfterMB},${memDeltaMB}\n`;
      }
      
      return csv;
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  clear(): void {
    this.suites.clear();
  }
}

// Predefined benchmarks
export class DatabaseBenchmarks {
  static async benchmarkQuery(queryFn: () => Promise<any>, iterations = 100): Promise<BenchmarkResult> {
    const benchmark = BenchmarkRunner.getInstance();
    return await benchmark.runBenchmark('database_query', queryFn, { iterations });
  }

  static async benchmarkConnection(connectionFn: () => Promise<void>, iterations = 50): Promise<BenchmarkResult> {
    const benchmark = BenchmarkRunner.getInstance();
    return await benchmark.runBenchmark('database_connection', connectionFn, { iterations });
  }

  static async benchmarkTransaction(transactionFn: () => Promise<void>, iterations = 50): Promise<BenchmarkResult> {
    const benchmark = BenchmarkRunner.getInstance();
    return await benchmark.runBenchmark('database_transaction', transactionFn, { iterations });
  }
}

export class AuthenticationBenchmarks {
  static async benchmarkPasswordHash(password: string, iterations = 100): Promise<BenchmarkResult> {
    const bcrypt = require('bcrypt');
    const benchmark = BenchmarkRunner.getInstance();
    
    return await benchmark.runBenchmark('password_hash', async () => {
      await bcrypt.hash(password, 12);
    }, { iterations, warmupIterations: 10 });
  }

  static async benchmarkPasswordVerify(password: string, hash: string, iterations = 1000): Promise<BenchmarkResult> {
    const bcrypt = require('bcrypt');
    const benchmark = BenchmarkRunner.getInstance();
    
    return await benchmark.runBenchmark('password_verify', async () => {
      await bcrypt.compare(password, hash);
    }, { iterations, warmupIterations: 100 });
  }

  static async benchmarkJWTSign(payload: any, secret: string, iterations = 1000): Promise<BenchmarkResult> {
    const jwt = require('jsonwebtoken');
    const benchmark = BenchmarkRunner.getInstance();
    
    return await benchmark.runBenchmark('jwt_sign', async () => {
      jwt.sign(payload, secret);
    }, { iterations, warmupIterations: 100 });
  }

  static async benchmarkJWTVerify(token: string, secret: string, iterations = 1000): Promise<BenchmarkResult> {
    const jwt = require('jsonwebtoken');
    const benchmark = BenchmarkRunner.getInstance();
    
    return await benchmark.runBenchmark('jwt_verify', async () => {
      jwt.verify(token, secret);
    }, { iterations, warmupIterations: 100 });
  }
}

export class CacheBenchmarks {
  static async benchmarkCacheSet(cache: any, key: string, value: any, iterations = 1000): Promise<BenchmarkResult> {
    const benchmark = BenchmarkRunner.getInstance();
    
    return await benchmark.runBenchmark('cache_set', async () => {
      cache.set(`${key}_${Math.random()}`, value);
    }, { iterations, warmupIterations: 100 });
  }

  static async benchmarkCacheGet(cache: any, key: string, iterations = 1000): Promise<BenchmarkResult> {
    const benchmark = BenchmarkRunner.getInstance();
    
    return await benchmark.runBenchmark('cache_get', async () => {
      cache.get(key);
    }, { iterations, warmupIterations: 100 });
  }

  static async benchmarkCacheDelete(cache: any, key: string, iterations = 1000): Promise<BenchmarkResult> {
    const benchmark = BenchmarkRunner.getInstance();
    
    return await benchmark.runBenchmark('cache_delete', async () => {
      cache.delete(`${key}_${Math.random()}`);
    }, { iterations, warmupIterations: 100 });
  }
}

export class APIBenchmarks {
  static async benchmarkRequest(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: any,
    iterations = 100
  ): Promise<BenchmarkResult> {
    const benchmark = BenchmarkRunner.getInstance();
    
    return await benchmark.runBenchmark('api_request', async () => {
      // This would use a proper HTTP client in production
      // For now, it's a placeholder
      await new Promise(resolve => setTimeout(resolve, 1));
    }, { iterations, warmupIterations: 10 });
  }
}

// Benchmark decorator
export function benchmark(options: {
  name?: string;
  iterations?: number;
  warmupIterations?: number;
  memoryTracking?: boolean;
} = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const benchmarkName = options.name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const benchmark = BenchmarkRunner.getInstance();
      
      const result = await benchmark.runBenchmark(
        benchmarkName,
        () => originalMethod.apply(this, args),
        options
      );

      // Store result for later analysis
      if (!this._benchmarkResults) {
        this._benchmarkResults = new Map();
      }
      this._benchmarkResults.set(benchmarkName, result);

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// Performance regression detection
export class PerformanceRegressionDetector {
  private static instance: PerformanceRegressionDetector;
  private baseline = new Map<string, BenchmarkResult>();
  private threshold = 0.1; // 10% regression threshold

  static getInstance(): PerformanceRegressionDetector {
    if (!PerformanceRegressionDetector.instance) {
      PerformanceRegressionDetector.instance = new PerformanceRegressionDetector();
    }
    return PerformanceRegressionDetector.instance;
  }

  setBaseline(name: string, result: BenchmarkResult): void {
    this.baseline.set(name, result);
    logger.info(`Performance baseline set: ${name}`, {
      opsPerSecond: result.opsPerSecond,
      duration: result.duration
    });
  }

  checkRegression(name: string, current: BenchmarkResult): {
    regression: boolean;
    degradation: number;
    baseline?: BenchmarkResult;
  } {
    const baseline = this.baseline.get(name);
    if (!baseline) {
      return { regression: false, degradation: 0 };
    }

    const degradation = (baseline.opsPerSecond - current.opsPerSecond) / baseline.opsPerSecond;
    const regression = degradation > this.threshold;

    if (regression) {
      logger.warn(`Performance regression detected: ${name}`, {
        degradation: `${(degradation * 100).toFixed(2)}%`,
        baseline: baseline.opsPerSecond,
        current: current.opsPerSecond
      });
    }

    return { regression, degradation, baseline };
  }

  setThreshold(threshold: number): void {
    this.threshold = threshold;
  }

  getBaseline(name: string): BenchmarkResult | undefined {
    return this.baseline.get(name);
  }

  getAllBaselines(): Map<string, BenchmarkResult> {
    return new Map(this.baseline);
  }
}

// Load testing utilities
export class LoadTester {
  static async runLoadTest(
    name: string,
    operation: () => Promise<void> | void,
    options: {
      concurrentUsers?: number;
      duration?: number;
      rampUpTime?: number;
    } = {}
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
    requestsPerSecond: number;
  }> {
    const {
      concurrentUsers = 10,
      duration = 30000, // 30 seconds
      rampUpTime = 5000 // 5 seconds
    } = options;

    logger.info(`Starting load test: ${name}`, { concurrentUsers, duration, rampUpTime });

    const results: number[] = [];
    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;

    const startTime = Date.now();
    const endTime = startTime + duration;

    const runUser = async (userId: number, delay: number): Promise<void> => {
      await new Promise(resolve => setTimeout(resolve, delay));

      while (Date.now() < endTime) {
        const requestStart = performance.now();
        
        try {
          await operation();
          successfulRequests++;
        } catch (error) {
          failedRequests++;
        }

        const requestEnd = performance.now();
        const requestTime = requestEnd - requestStart;
        results.push(requestTime);
        totalRequests++;

        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      }
    };

    // Start users with ramp-up
    const userPromises = [];
    const rampDelay = rampUpTime / concurrentUsers;

    for (let i = 0; i < concurrentUsers; i++) {
      userPromises.push(runUser(i, i * rampDelay));
    }

    await Promise.all(userPromises);

    const actualDuration = Date.now() - startTime;
    const averageResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length;
    const maxResponseTime = Math.max(...results);
    const minResponseTime = Math.min(...results);
    const requestsPerSecond = totalRequests / (actualDuration / 1000);

    const loadTestResult = {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      maxResponseTime,
      minResponseTime,
      requestsPerSecond
    };

    logger.info(`Load test completed: ${name}`, loadTestResult);

    return loadTestResult;
  }
}

export const benchmarkRunner = BenchmarkRunner.getInstance();
export const regressionDetector = PerformanceRegressionDetector.getInstance();
