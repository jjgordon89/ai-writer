/**
 * Performance monitoring and analytics service
 */

import { logger } from './logging';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'bytes' | 'count' | 'percent';
  timestamp: Date;
  metadata?: Record<string, unknown> | undefined;
}

export interface UserInteractionEvent {
  type: 'click' | 'scroll' | 'input' | 'navigation' | 'error';
  target: string;
  timestamp: Date;
  metadata?: Record<string, unknown> | undefined;
}

export interface ComponentRenderMetric {
  component: string;
  renderTime: number;
  updateCount: number;
  lastRender: Date;
  props?: Record<string, unknown> | undefined;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: PerformanceMetric[] = [];
  private interactions: UserInteractionEvent[] = [];
  private componentMetrics: Map<string, ComponentRenderMetric> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();
  private isEnabled: boolean = true;

  private constructor() {
    this.setupPerformanceObservers();
    this.setupErrorTracking();
  }

  static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled) {
      this.setupPerformanceObservers();
    } else {
      this.clearObservers();
    }
  }

  // Performance Monitoring
  recordMetric(name: string, value: number, unit: PerformanceMetric['unit'], metadata?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      metadata,
    };

    this.metrics.push(metric);
    this.enforceMetricsLimit();

    logger.debug(`Performance metric: ${name}`, {
      value,
      unit,
      ...metadata,
    });
  }

  startTimer(name: string, metadata?: Record<string, unknown>): () => void {
    if (!this.isEnabled) return () => {};

    const startTime = performance.now();
    const startMemory = this.getMemoryUsage();

    return () => {
      const duration = performance.now() - startTime;
      const memoryDelta = this.getMemoryUsage() - startMemory;

      this.recordMetric(name, duration, 'ms', {
        ...metadata,
        memoryDelta,
      });
    };
  }

  // Component Performance Monitoring
  recordComponentRender(component: string, renderTime: number, props?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    const existing = this.componentMetrics.get(component);
    const metric: ComponentRenderMetric = {
      component,
      renderTime,
      updateCount: existing ? existing.updateCount + 1 : 1,
      lastRender: new Date(),
      props,
    };

    this.componentMetrics.set(component, metric);

    // Log slow renders
    if (renderTime > 16) { // > 16ms = below 60fps
      logger.warn(`Slow component render: ${component}`, {
        renderTime,
        updateCount: metric.updateCount,
        props,
      });
    }
  }

  // User Interaction Tracking
  recordInteraction(type: UserInteractionEvent['type'], target: string, metadata?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    const interaction: UserInteractionEvent = {
      type,
      target,
      timestamp: new Date(),
      metadata,
    };

    this.interactions.push(interaction);
    this.enforceInteractionsLimit();

    logger.logUserAction(`${type}:${target}`, metadata);
  }

  // Memory Monitoring
  recordMemoryUsage(): void {
    if (!this.isEnabled) return;

    const usage = this.getMemoryUsage();
    if (usage > 0) {
      this.recordMetric('memory_usage', usage, 'bytes');
    }
  }

  // Network Monitoring
  recordNetworkRequest(url: string, method: string, status: number, duration: number, size?: number): void {
    if (!this.isEnabled) return;

    this.recordMetric('network_request', duration, 'ms', {
      url,
      method,
      status,
      size,
      success: status >= 200 && status < 400,
    });

    logger.logApiCall(method, url, status, duration, { size });
  }

  // Error Monitoring
  recordError(error: Error, context?: string, metadata?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    logger.error(`Error in ${context || 'unknown context'}`, error, metadata);

    this.recordInteraction('error', context || 'unknown', {
      errorName: error.name,
      errorMessage: error.message,
      ...metadata,
    });
  }

  // Analytics and Reporting
  getMetrics(name?: string, since?: Date): PerformanceMetric[] {
    let filtered = [...this.metrics];

    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }

    if (since) {
      filtered = filtered.filter(m => m.timestamp >= since);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getComponentMetrics(): ComponentRenderMetric[] {
    return Array.from(this.componentMetrics.values())
      .sort((a, b) => b.renderTime - a.renderTime);
  }

  getSlowComponents(threshold: number = 16): ComponentRenderMetric[] {
    return this.getComponentMetrics().filter(m => m.renderTime > threshold);
  }

  getInteractions(type?: UserInteractionEvent['type'], since?: Date): UserInteractionEvent[] {
    let filtered = [...this.interactions];

    if (type) {
      filtered = filtered.filter(i => i.type === type);
    }

    if (since) {
      filtered = filtered.filter(i => i.timestamp >= since);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  generateReport(): {
    summary: {
      totalMetrics: number;
      totalInteractions: number;
      avgMemoryUsage: number;
      slowComponents: number;
      errorCount: number;
    };
    topSlowComponents: ComponentRenderMetric[];
    recentErrors: UserInteractionEvent[];
    performanceAverages: Record<string, number>;
  } {
    const metrics = this.getMetrics();
    const interactions = this.getInteractions();
    const componentMetrics = this.getComponentMetrics();

    const memoryMetrics = metrics.filter(m => m.name === 'memory_usage');
    const avgMemoryUsage = memoryMetrics.length > 0
      ? memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length
      : 0;

    const slowComponents = componentMetrics.filter(m => m.renderTime > 16);
    const errorCount = interactions.filter(i => i.type === 'error').length;

    // Calculate averages for different metric types
    const performanceAverages: Record<string, number> = {};
    const metricGroups = metrics.reduce((groups, metric) => {
      if (!groups[metric.name]) groups[metric.name] = [];
      groups[metric.name].push(metric.value);
      return groups;
    }, {} as Record<string, number[]>);

    Object.entries(metricGroups).forEach(([name, values]) => {
      if (values && values.length > 0) {
        performanceAverages[name] = values.reduce((sum, v) => sum + v, 0) / values.length;
      }
    });

    return {
      summary: {
        totalMetrics: metrics.length,
        totalInteractions: interactions.length,
        avgMemoryUsage,
        slowComponents: slowComponents.length,
        errorCount,
      },
      topSlowComponents: slowComponents.slice(0, 10),
      recentErrors: interactions
        .filter(i => i.type === 'error')
        .slice(0, 10),
      performanceAverages,
    };
  }

  exportData(): string {
    return JSON.stringify({
      metrics: this.metrics,
      interactions: this.interactions,
      componentMetrics: Array.from(this.componentMetrics.entries()),
      report: this.generateReport(),
      timestamp: new Date().toISOString(),
    }, null, 2);
  }

  clearData(): void {
    this.metrics = [];
    this.interactions = [];
    this.componentMetrics.clear();
  }

  private setupPerformanceObservers(): void {
    if (!this.isEnabled || typeof PerformanceObserver === 'undefined') return;

    try {
      // Observe navigation timing
      if ('navigation' in PerformanceObserver.supportedEntryTypes) {
        const navigationObserver = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              const nav = entry as PerformanceNavigationTiming;
              this.recordMetric('page_load', nav.loadEventEnd - nav.fetchStart, 'ms');
              this.recordMetric('dom_content_loaded', nav.domContentLoadedEventEnd - nav.fetchStart, 'ms');
              this.recordMetric('first_paint', nav.loadEventEnd - nav.fetchStart, 'ms');
            }
          } catch (error) {
            logger.error('Error in navigation observer:', error instanceof Error ? error : new Error(String(error)));
          }
        });
        navigationObserver.observe({ entryTypes: ['navigation'] });
        this.observers.set('navigation', navigationObserver);
      }

      // Observe paint timing
      if ('paint' in PerformanceObserver.supportedEntryTypes) {
        const paintObserver = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              this.recordMetric(entry.name.replace('-', '_'), entry.startTime, 'ms');
            }
          } catch (error) {
            logger.error('Error in paint observer:', error instanceof Error ? error : new Error(String(error)));
          }
        });
        paintObserver.observe({ entryTypes: ['paint'] });
        this.observers.set('paint', paintObserver);
      }

      // Observe largest contentful paint
      if ('largest-contentful-paint' in PerformanceObserver.supportedEntryTypes) {
        const lcpObserver = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              this.recordMetric('largest_contentful_paint', entry.startTime, 'ms');
            }
          } catch (error) {
            logger.error('Error in LCP observer:', error instanceof Error ? error : new Error(String(error)));
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.set('lcp', lcpObserver);
      }

      // Observe layout shifts
      if ('layout-shift' in PerformanceObserver.supportedEntryTypes) {
        const clsObserver = new PerformanceObserver((list) => {
          try {
            for (const entry of list.getEntries()) {
              const layoutShift = entry as unknown as { hadRecentInput: boolean; value: number };
              if (!layoutShift.hadRecentInput) {
                this.recordMetric('cumulative_layout_shift', layoutShift.value, 'count');
              }
            }
          } catch (error) {
            logger.error('Error in CLS observer:', error instanceof Error ? error : new Error(String(error)));
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.set('cls', clsObserver);
      }
    } catch (error) {
      logger.error('Error setting up performance observers:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private setupErrorTracking(): void {
    if (!this.isEnabled) return;

    try {
      // Track unhandled errors
      window.addEventListener('error', this.handleError);

      // Track unhandled promise rejections
      window.addEventListener('unhandledrejection', this.handlePromiseRejection);
    } catch (error) {
      logger.error('Error setting up error tracking:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private clearObservers(): void {
    try {
      this.observers.forEach((observer, key) => {
        try {
          observer.disconnect();
        } catch (error) {
          logger.error(`Error disconnecting observer ${key}:`, error instanceof Error ? error : new Error(String(error)));
        }
      });
      this.observers.clear();
    } catch (error) {
      logger.error('Error clearing observers:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  // Public method to safely cleanup and destroy monitoring instance
  destroy(): void {
    this.setEnabled(false);
    this.clearObservers();
    this.clearData();
    
    // Remove event listeners
    try {
      window.removeEventListener('error', this.handleError);
      window.removeEventListener('unhandledrejection', this.handlePromiseRejection);
    } catch (error) {
      logger.error('Error removing event listeners:', error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleError = (event: ErrorEvent) => {
    this.recordError(new Error(event.message), 'window', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  };

  private handlePromiseRejection = (event: PromiseRejectionEvent) => {
    this.recordError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      'unhandled_promise'
    );
  };

  private enforceMetricsLimit(): void {
    const maxMetrics = 10000;
    if (this.metrics.length > maxMetrics) {
      this.metrics = this.metrics.slice(-maxMetrics);
    }
  }

  private enforceInteractionsLimit(): void {
    const maxInteractions = 5000;
    if (this.interactions.length > maxInteractions) {
      this.interactions = this.interactions.slice(-maxInteractions);
    }
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      return (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
    }
    return 0;
  }
}

// Global monitoring instance
export const monitoring = MonitoringService.getInstance();