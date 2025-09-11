// HTTP connection pool for optimized network requests
import fetch from 'node-fetch';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

/**
 * Connection pool manager for ProSBC HTTP requests
 * Provides connection reuse, request queuing, and retry logic
 */
class ConnectionPool {
  constructor() {
    // HTTP agents for connection pooling
    this.httpAgent = new HttpAgent({
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 30000,
      freeSocketTimeout: 15000
    });

    this.httpsAgent = new HttpsAgent({
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 30000,
      freeSocketTimeout: 15000,
      rejectUnauthorized: false // For self-signed certificates
    });

    // Request queue management
    this.requestQueues = new Map(); // instanceId -> queue
    this.concurrentRequests = new Map(); // instanceId -> count
    this.maxConcurrentPerInstance = 5;
    this.requestDelay = 50; // ms between requests to same instance
    
    // Request statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retryCount: 0,
      avgResponseTime: 0,
      responseTimes: []
    };
  }

  /**
   * Make an HTTP request with connection pooling and queuing
   */
  async request(instanceId, url, options = {}) {
    const requestId = `${instanceId}_${Date.now()}_${Math.random()}`;
    
    return new Promise((resolve, reject) => {
      this.addToQueue(instanceId, {
        requestId,
        url,
        options,
        resolve,
        reject,
        attempts: 0,
        maxRetries: options.maxRetries || 2
      });
    });
  }

  /**
   * Add request to queue for rate limiting
   */
  addToQueue(instanceId, requestData) {
    if (!this.requestQueues.has(instanceId)) {
      this.requestQueues.set(instanceId, []);
    }
    
    this.requestQueues.get(instanceId).push(requestData);
    this.processQueue(instanceId);
  }

  /**
   * Process queued requests for an instance
   */
  async processQueue(instanceId) {
    const queue = this.requestQueues.get(instanceId);
    if (!queue || queue.length === 0) return;

    const concurrent = this.concurrentRequests.get(instanceId) || 0;
    if (concurrent >= this.maxConcurrentPerInstance) return;

    const requestData = queue.shift();
    if (!requestData) return;

    // Increment concurrent counter
    this.concurrentRequests.set(instanceId, concurrent + 1);

    try {
      await this.executeRequest(requestData);
    } finally {
      // Decrement concurrent counter
      const newConcurrent = (this.concurrentRequests.get(instanceId) || 1) - 1;
      this.concurrentRequests.set(instanceId, Math.max(0, newConcurrent));

      // Process next request after delay
      setTimeout(() => this.processQueue(instanceId), this.requestDelay);
    }
  }

  /**
   * Execute the actual HTTP request
   */
  async executeRequest(requestData) {
    const { url, options, resolve, reject, attempts, maxRetries } = requestData;
    const startTime = Date.now();

    try {
      // Prepare fetch options with connection pooling
      const fetchOptions = {
        ...options,
        agent: url.startsWith('https:') ? this.httpsAgent : this.httpAgent,
        timeout: options.timeout || 30000
      };

      // Add default headers
      fetchOptions.headers = {
        'User-Agent': 'Mozilla/5.0 (ProSBC-Automation-Optimized)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        ...fetchOptions.headers
      };

      const response = await fetch(url, fetchOptions);
      const responseTime = Date.now() - startTime;

      // Update statistics
      this.updateStats(responseTime, true);
      this.stats.totalRequests++;
      this.stats.successfulRequests++;

      resolve(response);

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(responseTime, false);
      
      // Retry logic
      if (attempts < maxRetries && this.shouldRetry(error)) {
        console.log(`[ConnectionPool] Retrying request ${requestData.requestId}, attempt ${attempts + 1}/${maxRetries + 1}`);
        
        requestData.attempts++;
        this.stats.retryCount++;
        
        // Exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, attempts), 5000);
        setTimeout(() => {
          this.executeRequest(requestData);
        }, retryDelay);
        
        return;
      }

      this.stats.totalRequests++;
      this.stats.failedRequests++;
      reject(error);
    }
  }

  /**
   * Determine if request should be retried
   */
  shouldRetry(error) {
    // Retry on network errors, timeouts, and 5xx responses
    return (
      error.code === 'ECONNRESET' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.type === 'request-timeout' ||
      (error.response && error.response.status >= 500)
    );
  }

  /**
   * Update response time statistics
   */
  updateStats(responseTime, success) {
    this.stats.responseTimes.push(responseTime);
    
    // Keep only last 100 response times
    if (this.stats.responseTimes.length > 100) {
      this.stats.responseTimes.shift();
    }
    
    // Calculate average response time
    this.stats.avgResponseTime = this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length;
  }

  /**
   * Make a GET request
   */
  async get(instanceId, url, options = {}) {
    return this.request(instanceId, url, { ...options, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post(instanceId, url, options = {}) {
    return this.request(instanceId, url, { ...options, method: 'POST' });
  }

  /**
   * Make a DELETE request
   */
  async delete(instanceId, url, options = {}) {
    return this.request(instanceId, url, { ...options, method: 'DELETE' });
  }

  /**
   * Make a PUT request
   */
  async put(instanceId, url, options = {}) {
    return this.request(instanceId, url, { ...options, method: 'PUT' });
  }

  /**
   * Batch multiple requests to the same instance
   */
  async batchRequest(instanceId, requests) {
    const promises = requests.map(req => {
      const { url, options = {} } = req;
      return this.request(instanceId, url, options);
    });

    return Promise.allSettled(promises);
  }

  /**
   * Clear queue for an instance
   */
  clearQueue(instanceId) {
    const queue = this.requestQueues.get(instanceId);
    if (queue) {
      // Reject all pending requests
      queue.forEach(req => {
        req.reject(new Error('Queue cleared'));
      });
      this.requestQueues.set(instanceId, []);
    }
    
    this.concurrentRequests.set(instanceId, 0);
    console.log(`[ConnectionPool] Cleared queue for instance: ${instanceId}`);
  }

  /**
   * Get connection pool statistics
   */
  getStats() {
    const queueSizes = {};
    for (const [instanceId, queue] of this.requestQueues.entries()) {
      queueSizes[instanceId] = queue.length;
    }

    const concurrent = {};
    for (const [instanceId, count] of this.concurrentRequests.entries()) {
      concurrent[instanceId] = count;
    }

    return {
      ...this.stats,
      successRate: this.stats.totalRequests > 0 ? 
        (this.stats.successfulRequests / this.stats.totalRequests) * 100 : 0,
      errorRate: this.stats.totalRequests > 0 ? 
        (this.stats.failedRequests / this.stats.totalRequests) * 100 : 0,
      queueSizes,
      concurrentRequests: concurrent,
      retryRate: this.stats.totalRequests > 0 ? 
        (this.stats.retryCount / this.stats.totalRequests) * 100 : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retryCount: 0,
      avgResponseTime: 0,
      responseTimes: []
    };
  }

  /**
   * Cleanup and close connections
   */
  destroy() {
    this.httpAgent.destroy();
    this.httpsAgent.destroy();
    
    // Clear all queues
    for (const instanceId of this.requestQueues.keys()) {
      this.clearQueue(instanceId);
    }
  }
}

// Global connection pool instance
export const connectionPool = new ConnectionPool();

export default connectionPool;
