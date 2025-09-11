// Advanced session pool management for multi-ProSBC instances
import { prosbcLogin } from '../login.js';

/**
 * Global session pool for managing multiple ProSBC instance sessions
 * Provides connection pooling, session reuse, and automatic cleanup
 */

// Helper function to validate if existing session is still active
async function validateSession(baseURL, sessionCookie) {
  try {
    const response = await fetch(`${baseURL}/`, {
      headers: {
        'Cookie': `_WebOAMP_session=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)'
      },
      timeout: 5000
    });
    
    // If we get a successful response or redirect (not auth error), session is valid
    return response.status !== 401 && response.status !== 403;
  } catch (error) {
    // If request fails, assume session is invalid
    return false;
  }
}
class SessionPool {
  constructor() {
    this.sessions = new Map(); // instanceId -> session data
    this.maxSessionsPerInstance = 3;
    this.sessionTimeout = 25 * 60 * 1000; // 25 minutes (ProSBC sessions typically expire at 30min)
    this.cleanupInterval = 5 * 60 * 1000; // Cleanup every 5 minutes
    this.requestQueues = new Map(); // instanceId -> request queue
    this.processing = new Map(); // instanceId -> processing status
    
    // Start cleanup timer
    this.startCleanupTimer();
  }

  /**
   * Get or create a session for a ProSBC instance
   * @param {string} instanceId - ProSBC instance identifier
   * @param {object} credentials - Instance credentials {baseUrl, username, password}
   * @returns {Promise<string>} Session cookie value
   */
  async getSession(instanceId, credentials) {
    const sessionKey = `${instanceId}:${credentials.baseUrl}`;
    const existing = this.sessions.get(sessionKey);
    
    // Return existing valid session
    if (existing && this.isSessionValid(existing)) {
      // Validate session before returning it
      console.log(`[SessionPool] Validating existing session for ${instanceId}...`);
      const isValid = await validateSession(credentials.baseUrl, existing.cookie);
      if (isValid) {
        console.log(`[SessionPool] Session still valid for ${instanceId}, reusing...`);
        existing.lastUsed = Date.now();
        return existing.cookie;
      } else {
        console.log(`[SessionPool] Session expired for ${instanceId}, will create new...`);
        this.sessions.delete(sessionKey); // Remove invalid session
      }
    }

    // Check if we're already creating a session for this instance
    if (this.processing.get(instanceId)) {
      return this.waitForSessionCreation(instanceId, credentials);
    }

    return this.createNewSession(instanceId, credentials);
  }

  /**
   * Create a new session with queue management
   */
  async createNewSession(instanceId, credentials) {
    const sessionKey = `${instanceId}:${credentials.baseUrl}`;
    this.processing.set(instanceId, true);

    try {
      console.log(`[SessionPool] Creating new session for instance: ${instanceId}`);
      const cookie = await prosbcLogin(credentials.baseUrl, credentials.username, credentials.password);
      
      const sessionData = {
        cookie,
        created: Date.now(),
        lastUsed: Date.now(),
        instanceId,
        baseUrl: credentials.baseUrl
      };

      this.sessions.set(sessionKey, sessionData);
      
      // Cleanup old sessions for this instance if we have too many
      this.cleanupInstanceSessions(instanceId);
      
      return cookie;
    } finally {
      this.processing.set(instanceId, false);
    }
  }

  /**
   * Wait for an ongoing session creation to complete
   */
  async waitForSessionCreation(instanceId, credentials, maxWait = 10000) {
    const start = Date.now();
    while (this.processing.get(instanceId) && (Date.now() - start) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Try to get the session that should now be created
    const sessionKey = `${instanceId}:${credentials.baseUrl}`;
    const session = this.sessions.get(sessionKey);
    if (session && this.isSessionValid(session)) {
      return session.cookie;
    }
    
    // If still no session, create one
    return this.createNewSession(instanceId, credentials);
  }

  /**
   * Check if a session is still valid
   */
  isSessionValid(session) {
    const age = Date.now() - session.created;
    const idle = Date.now() - session.lastUsed;
    
    return age < this.sessionTimeout && idle < (this.sessionTimeout / 2);
  }

  /**
   * Clean up old sessions for a specific instance
   */
  cleanupInstanceSessions(instanceId) {
    const instanceSessions = Array.from(this.sessions.entries())
      .filter(([key, session]) => session.instanceId === instanceId)
      .sort(([, a], [, b]) => b.lastUsed - a.lastUsed); // Sort by most recently used

    // Keep only the most recent sessions up to maxSessionsPerInstance
    if (instanceSessions.length > this.maxSessionsPerInstance) {
      const toRemove = instanceSessions.slice(this.maxSessionsPerInstance);
      toRemove.forEach(([key]) => {
        console.log(`[SessionPool] Removing old session: ${key}`);
        this.sessions.delete(key);
      });
    }
  }

  /**
   * Start automatic cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * Clean up expired sessions
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, session] of this.sessions.entries()) {
      if (!this.isSessionValid(session)) {
        this.sessions.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[SessionPool] Cleaned up ${cleaned} expired sessions`);
    }
  }

  /**
   * Force invalidate a session (e.g., when login fails)
   */
  invalidateSession(instanceId, baseUrl) {
    const sessionKey = `${instanceId}:${baseUrl}`;
    this.sessions.delete(sessionKey);
    console.log(`[SessionPool] Invalidated session: ${sessionKey}`);
  }

  /**
   * Clear all sessions for an instance
   */
  clearInstanceSessions(instanceId) {
    const toRemove = Array.from(this.sessions.keys())
      .filter(key => this.sessions.get(key).instanceId === instanceId);
    
    toRemove.forEach(key => this.sessions.delete(key));
    console.log(`[SessionPool] Cleared ${toRemove.length} sessions for instance: ${instanceId}`);
  }

  /**
   * Get statistics
   */
  getStats() {
    const instanceCounts = new Map();
    
    for (const session of this.sessions.values()) {
      const count = instanceCounts.get(session.instanceId) || 0;
      instanceCounts.set(session.instanceId, count + 1);
    }

    return {
      totalSessions: this.sessions.size,
      instanceCounts: Object.fromEntries(instanceCounts),
      processing: Object.fromEntries(this.processing)
    };
  }
}

// Global session pool instance
export const sessionPool = new SessionPool();

export default sessionPool;
