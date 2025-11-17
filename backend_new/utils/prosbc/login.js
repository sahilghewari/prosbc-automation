// Utility to login to ProSBC and get the _WebOAMP_session cookie
import axios from 'axios';

/**
 * Logs in to ProSBC and returns the session cookie
 * @param {string} baseUrl - ProSBC base URL
 * @param {string} username - ProSBC username
 * @param {string} password - ProSBC password
 * @returns {Promise<string>} The _WebOAMP_session cookie value
 */
export async function prosbcLogin(baseUrl, username, password) {
  // Validate URL format
  if (!baseUrl) {
    throw new Error("Invalid URL: URL is empty or undefined");
  }
  
  // Ensure URL has protocol
  let normalizedUrl = baseUrl;
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }
  
  // Remove trailing slashes to avoid double slashes in URLs
  normalizedUrl = normalizedUrl.replace(/\/+$/, '');
  
  console.log(`Attempting to login to: ${normalizedUrl}`);
  
  const loginUrl = `${normalizedUrl}/login`;
  const loginPostUrl = `${normalizedUrl}/login/check`;
  
  // Step 1: Fetch login page to get authenticity_token
  let authenticityToken = null;
  let initialCookies = '';
  try {
    const loginPageResp = await axios.get(loginUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 0,
      validateStatus: status => status === 200,
    });
    // Extract authenticity_token from HTML
    const match = loginPageResp.data.match(/name="authenticity_token" type="hidden" value="([^"]+)"/);
    if (match) {
      authenticityToken = match[1];
    } else {
      throw new Error('authenticity_token not found in login page');
    }
    // Get initial cookies (for CSRF/session)
    if (loginPageResp.headers['set-cookie']) {
      initialCookies = loginPageResp.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    }
  } catch (err) {
    throw new Error('Failed to fetch login page or extract authenticity_token: ' + err.message);
  }

  // Step 2: POST login with token
  const params = new URLSearchParams();
  params.append('authenticity_token', authenticityToken);
  params.append('user[name]', username);
  params.append('user[pass]', password);
  params.append('commit', 'Login');

  try {
    const response = await axios.post(loginPostUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: initialCookies,
        Referer: loginUrl,
      },
      maxRedirects: 0, // Don't follow redirect
      validateStatus: status => status === 302 || status === 200 || status === 401,
    });
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      const sessionCookie = setCookie.find(c => c.startsWith('_WebOAMP_session='));
      if (sessionCookie) {
        return sessionCookie.split(';')[0].split('=')[1];
      }
    }
    throw new Error('Session cookie not found in login response');
  } catch (error) {
    throw new Error('ProSBC login failed: ' + (error.response?.status || error.message));
  }
}
