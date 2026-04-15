export interface ApiMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  lastReset: Date;
}

export interface EndpointMetrics {
  [endpoint: string]: {
    count: number;
    averageResponseTime: number;
    errors: number;
    lastAccessed: Date;
  };
}

class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: ApiMetrics;
  private endpoints: EndpointMetrics;
  private responseTimes: number[] = [];
  private requestTimestamps: number[] = [];

  private constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsPerMinute: 0,
      errorRate: 0,
      lastReset: new Date()
    };
    this.endpoints = {};
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  recordRequest(endpoint: string, responseTime: number, success: boolean): void {
    const now = Date.now();
    
    // Update overall metrics
    this.metrics.totalRequests++;
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    // Track response times
    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    this.metrics.averageResponseTime = this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length;

    // Track request timestamps for RPM calculation
    this.requestTimestamps.push(now);
    const oneMinuteAgo = now - 60000;
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > oneMinuteAgo);
    this.metrics.requestsPerMinute = this.requestTimestamps.length;

    // Update error rate
    this.metrics.errorRate = this.metrics.totalRequests > 0 
      ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100 
      : 0;

    // Update endpoint metrics
    if (!this.endpoints[endpoint]) {
      this.endpoints[endpoint] = {
        count: 0,
        averageResponseTime: 0,
        errors: 0,
        lastAccessed: new Date()
      };
    }

    const endpointMetric = this.endpoints[endpoint];
    endpointMetric.count++;
    endpointMetric.lastAccessed = new Date();
    
    if (!success) {
      endpointMetric.errors++;
    }

    // Calculate average response time for endpoint
    // This is a simplified calculation - in production, you'd want a more sophisticated approach
    endpointMetric.averageResponseTime = 
      (endpointMetric.averageResponseTime * (endpointMetric.count - 1) + responseTime) / endpointMetric.count;
  }

  getMetrics(): ApiMetrics {
    return { ...this.metrics };
  }

  getEndpointMetrics(): EndpointMetrics {
    return { ...this.endpoints };
  }

  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsPerMinute: 0,
      errorRate: 0,
      lastReset: new Date()
    };
    this.endpoints = {};
    this.responseTimes = [];
    this.requestTimestamps = [];
  }
}

export const metrics = MetricsCollector.getInstance();

// Middleware to collect metrics
export const metricsMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  const endpoint = `${req.method} ${req.route?.path || req.path}`;

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const success = res.statusCode < 400;
    
    metrics.recordRequest(endpoint, responseTime, success);
  });

  next();
};
