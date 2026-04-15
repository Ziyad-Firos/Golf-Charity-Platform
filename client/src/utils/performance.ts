interface PerformanceMetrics {
  pageLoad: number;
  apiResponse: number;
  renderTime: number;
  memoryUsage?: number;
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private startTime: number = 0;

  private constructor() {
    this.startTime = performance.now();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTimer(): number {
    return performance.now();
  }

  endTimer(startTime: number, type: keyof PerformanceMetrics): number {
    const duration = performance.now() - startTime;
    this.recordMetric(type, duration);
    return duration;
  }

  private recordMetric(type: keyof PerformanceMetrics, value: number): void {
    const metric: PerformanceMetrics = {
      pageLoad: 0,
      apiResponse: 0,
      renderTime: 0,
      [type]: value
    };

    this.metrics.push(metric);
    
    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }

    // Log slow operations
    if (type === 'apiResponse' && value > 1000) {
      console.warn(`Slow API response: ${value}ms`);
    }
    
    if (type === 'renderTime' && value > 100) {
      console.warn(`Slow render: ${value}ms`);
    }
  }

  getMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  getAverageMetric(type: keyof PerformanceMetrics): number {
    const typeMetrics = this.metrics.filter(m => m[type] > 0);
    if (typeMetrics.length === 0) return 0;
    
    const sum = typeMetrics.reduce((acc, m) => acc + m[type], 0);
    return sum / typeMetrics.length;
  }

  measurePageLoad(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const pageLoad = navigation.loadEventEnd - navigation.fetchStart;
      this.recordMetric('pageLoad', pageLoad);
    }
  }

  measureMemoryUsage(): number | null {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      const usage = memory.usedJSHeapSize / 1024 / 1024; // Convert to MB
      this.recordMetric('memoryUsage', usage);
      return usage;
    }
    return null;
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance();

// React Hook for performance monitoring
export const usePerformanceMonitor = () => {
  const startMeasurement = (type: keyof PerformanceMetrics) => {
    return performanceMonitor.startTimer();
  };

  const endMeasurement = (startTime: number, type: keyof PerformanceMetrics) => {
    return performanceMonitor.endTimer(startTime, type);
  };

  const getMetrics = () => performanceMonitor.getMetrics();
  const getAverageMetric = (type: keyof PerformanceMetrics) => performanceMonitor.getAverageMetric(type);

  return {
    startMeasurement,
    endMeasurement,
    getMetrics,
    getAverageMetric,
    measurePageLoad: () => performanceMonitor.measurePageLoad(),
    measureMemoryUsage: () => performanceMonitor.measureMemoryUsage()
  };
};
