// Session Manager - Handles ProSBC session management and authentication
// Manages _WebOAMP_session cookies and authentication state
export class SessionManager {
  constructor() {
    this.sessionCookie = null;
    this.authenticityToken = null;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.lastActivity = null;
    this.sessionId = null;
  }

  // Extract session cookie from Set-Cookie header
  extractSessionCookie(setCookieHeaders) {
    if (!setCookieHeaders) return null;
    
    let sessionCookie = null;
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    
    for (const header of headers) {
      if (header.includes('_WebOAMP_session')) {
        // Extract the session cookie value
        const match = header.match(/_WebOAMP_session=([^;]+)/);
        if (match) {
          sessionCookie = `_WebOAMP_session=${match[1]}`;
          this.sessionId = match[1];
          this.lastActivity = new Date();
          console.log('Session cookie extracted:', sessionCookie.substring(0, 50) + '...');
          break;
        }
      }
    }
    
    this.sessionCookie = sessionCookie;
    return sessionCookie;
  }

  // Get current session cookie
  getSessionCookie() {
    if (this.isSessionExpired()) {
      console.log('Session expired, clearing cookie');
      this.clearSession();
      return null;
    }
    
    return this.sessionCookie;
  }

  // Set session cookie manually
  setSessionCookie(cookie) {
    this.sessionCookie = cookie;
    this.lastActivity = new Date();
    
    // Extract session ID from cookie
    const match = cookie.match(/_WebOAMP_session=([^;]+)/);
    if (match) {
      this.sessionId = match[1];
    }
    
    console.log('Session cookie set manually');
  }

  // Check if session is expired
  isSessionExpired() {
    if (!this.sessionCookie || !this.lastActivity) {
      return true;
    }
    
    const now = new Date();
    const timeSinceLastActivity = now - this.lastActivity;
    
    return timeSinceLastActivity > this.sessionTimeout;
  }

  // Update last activity timestamp
  updateActivity() {
    this.lastActivity = new Date();
  }

  // Clear session data
  clearSession() {
    this.sessionCookie = null;
    this.authenticityToken = null;
    this.sessionId = null;
    this.lastActivity = null;
    console.log('Session cleared');
  }

  // Get authenticity token
  getAuthenticityToken() {
    return this.authenticityToken;
  }

  // Set authenticity token
  setAuthenticityToken(token) {
    this.authenticityToken = token;
    console.log('Authenticity token set:', token.substring(0, 20) + '...');
  }

  // Extract authenticity token from HTML
  extractAuthenticityToken(html) {
    const tokenMatch = html.match(/name="authenticity_token"[^>]*value="([^"]+)"/);
    if (tokenMatch) {
      this.setAuthenticityToken(tokenMatch[1]);
      return tokenMatch[1];
    }
    return null;
  }

  // Get session info
  getSessionInfo() {
    return {
      hasSession: !!this.sessionCookie,
      hasToken: !!this.authenticityToken,
      sessionId: this.sessionId,
      lastActivity: this.lastActivity,
      isExpired: this.isSessionExpired(),
      timeRemaining: this.getTimeRemaining()
    };
  }

  // Get time remaining in session
  getTimeRemaining() {
    if (!this.lastActivity) return 0;
    
    const now = new Date();
    const elapsed = now - this.lastActivity;
    const remaining = this.sessionTimeout - elapsed;
    
    return Math.max(0, remaining);
  }

  // Get time remaining in minutes
  getTimeRemainingMinutes() {
    return Math.floor(this.getTimeRemaining() / 60000);
  }

  // Check if session needs refresh
  needsRefresh() {
    const remaining = this.getTimeRemaining();
    const refreshThreshold = 5 * 60 * 1000; // 5 minutes
    
    return remaining > 0 && remaining < refreshThreshold;
  }

  // Create cookie header for requests
  getCookieHeader() {
    const sessionCookie = this.getSessionCookie();
    if (!sessionCookie) return null;
    
    return sessionCookie;
  }

  // Validate session with a test request
  async validateSession(apiClient) {
    try {
      if (!this.sessionCookie) {
        return { valid: false, reason: 'No session cookie' };
      }
      
      // Make a lightweight request to check session validity
      const response = await apiClient.get('/file_dbs/1/routesets_definitions', {
        headers: {
          'Cookie': this.sessionCookie
        }
      });
      
      // Check if response redirects to login
      if (response.data && response.data.includes('login_form')) {
        this.clearSession();
        return { valid: false, reason: 'Session expired - redirected to login' };
      }
      
      this.updateActivity();
      return { valid: true };
      
    } catch (error) {
      console.error('Session validation error:', error);
      
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        this.clearSession();
        return { valid: false, reason: 'Authentication failed' };
      }
      
      return { valid: false, reason: error.message };
    }
  }

  // Refresh session by making a request
  async refreshSession(apiClient) {
    try {
      console.log('Refreshing session...');
      
      const response = await apiClient.get('/file_dbs/1/routesets_definitions', {
        headers: {
          'Cookie': this.sessionCookie
        }
      });
      
      // Update session cookie if new one is provided
      const setCookieHeader = response.headers['set-cookie'];
      if (setCookieHeader) {
        this.extractSessionCookie(setCookieHeader);
      }
      
      this.updateActivity();
      console.log('Session refreshed successfully');
      
      return { success: true };
      
    } catch (error) {
      console.error('Session refresh error:', error);
      this.clearSession();
      return { success: false, error: error.message };
    }
  }

  // Auto-refresh session if needed
  async autoRefreshSession(apiClient) {
    if (this.needsRefresh()) {
      console.log('Session needs refresh, attempting auto-refresh...');
      return await this.refreshSession(apiClient);
    }
    
    return { success: true, message: 'No refresh needed' };
  }

  // Get session status summary
  getStatusSummary() {
    const info = this.getSessionInfo();
    
    if (!info.hasSession) {
      return 'No session';
    }
    
    if (info.isExpired) {
      return 'Session expired';
    }
    
    const minutesRemaining = this.getTimeRemainingMinutes();
    
    if (minutesRemaining < 5) {
      return `Session expiring soon (${minutesRemaining}m remaining)`;
    }
    
    return `Session active (${minutesRemaining}m remaining)`;
  }

  // Set session timeout (in minutes)
  setSessionTimeout(minutes) {
    this.sessionTimeout = minutes * 60 * 1000;
    console.log(`Session timeout set to ${minutes} minutes`);
  }
}

// Create and export singleton instance
export const sessionManager = new SessionManager();

// Export convenience functions
export const getSessionCookie = () => sessionManager.getSessionCookie();
export const setSessionCookie = (cookie) => sessionManager.setSessionCookie(cookie);
export const getAuthenticityToken = () => sessionManager.getAuthenticityToken();
export const setAuthenticityToken = (token) => sessionManager.setAuthenticityToken(token);
export const clearSession = () => sessionManager.clearSession();
export const getSessionInfo = () => sessionManager.getSessionInfo();
export const validateSession = (apiClient) => sessionManager.validateSession(apiClient);
export const refreshSession = (apiClient) => sessionManager.refreshSession(apiClient);
export const getStatusSummary = () => sessionManager.getStatusSummary();