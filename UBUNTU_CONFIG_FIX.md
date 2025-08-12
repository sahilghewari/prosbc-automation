# Ubuntu Deployment Config Loading Fix

## Problem Description

When deployed on Ubuntu servers, the ProSBC automation system exhibited the following issues:

1. **Configs not loading automatically after login** - Users would see "No configs available" even when ProSBC instances were properly loaded
2. **Manual instance switching required** - Users had to manually change the ProSBC instance to trigger config loading
3. **Intermittent failures** - Configs would load sometimes but fail other times, especially on fresh deployments

## Root Causes Identified

### 1. **Timing Issues in Ubuntu Environment**
- ProSBC login and session establishment takes longer in Ubuntu deployed environments
- Network latency between the backend and ProSBC servers
- Race conditions between authentication and config fetching

### 2. **HTML Parsing Sensitivity**
- The `fetchLiveConfigIds` function parses ProSBC's HTML dropdown to extract configurations
- Different ProSBC versions or network conditions could affect HTML structure
- Missing error handling for edge cases

### 3. **No Persistence of ProSBC Instance Selection**
- Instance selection was not persisted across logout/login cycles
- Users would lose their selected instance and have to re-select it

### 4. **Insufficient Retry Logic**
- No retry mechanism for failed config fetching
- Backend cache not being cleared on authentication failures

## Solutions Implemented

### 1. **Enhanced Frontend Instance Persistence**

**File: `frontend/src/contexts/ProSBCInstanceContext.jsx`**
- Added localStorage persistence for selected ProSBC instance
- Instance selection now survives logout/login cycles
- Added `clearInstanceSelection()` for proper cleanup

```javascript
// Helper functions for localStorage persistence
const SELECTED_INSTANCE_KEY = 'prosbc_selected_instance_id';

const saveSelectedInstanceId = (instanceId) => {
  try {
    if (instanceId) {
      localStorage.setItem(SELECTED_INSTANCE_KEY, instanceId.toString());
    } else {
      localStorage.removeItem(SELECTED_INSTANCE_KEY);
    }
  } catch (error) {
    console.warn('[ProSBCInstanceContext] Failed to save selected instance to localStorage:', error);
  }
};
```

### 2. **Improved Config Fetching with Retry Logic**

**File: `frontend/src/components/Sidebar.jsx`**
- Added exponential backoff retry mechanism
- Enhanced error handling and logging
- Added manual refresh buttons with cache clearing
- Better validation of instance availability before fetching

```javascript
// Helper function to retry with exponential backoff
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`[Sidebar] Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error; // Re-throw on final attempt
      }
      
      // Wait with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[Sidebar] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
```

### 3. **Backend Retry Logic and Error Handling**

**File: `backend_new/server.js`**
- Added retry logic for ProSBC login and config fetching
- Better error messages and logging
- Graceful fallback handling

```javascript
try {
  console.log('[test-configs] Step 1: Attempting ProSBC login...');
  sessionCookie = await prosbcLogin(baseURL, username, password);
  console.log('[test-configs] Step 1: ✓ ProSBC login successful');
  
  console.log('[test-configs] Step 2: Fetching configurations...');
  configs = await fetchLiveConfigIds(baseURL, sessionCookie);
  console.log(`[test-configs] Step 2: ✓ Retrieved ${configs.length} configs`);
  
  if (!configs || configs.length === 0) {
    throw new Error('No configurations found');
  }
  
} catch (firstAttemptError) {
  console.warn('[test-configs] First attempt failed:', firstAttemptError.message);
  console.log('[test-configs] Retrying with fresh session...');
  
  // Retry logic with fresh session...
}
```

### 4. **Enhanced HTML Parsing with Fallbacks**

**File: `backend_new/utils/prosbc/prosbcConfigLiveFetcher.js`**
- Added network timeout handling
- Better session expiry detection
- Fallback config generation if parsing fails
- More robust error messages

```javascript
// Check if we got redirected to login page
if (html.includes('login') && html.includes('Username')) {
  console.error(`[Config Fetcher] Redirected to login page - session expired`);
  throw new Error('Session expired - redirected to login page');
}

// If no configs were found, try to provide a fallback
if (configs.length === 0) {
  console.warn(`[Config Fetcher] No configs found via parsing. Providing fallback...`);
  
  // Try to extract any configuration ID from the HTML
  const anyConfigMatch = html.match(/configuration[^>]*=["']?(\d+)["']?/i);
  if (anyConfigMatch) {
    const fallbackId = anyConfigMatch[1];
    console.log(`[Config Fetcher] Found fallback config ID: ${fallbackId}`);
    configs.push({
      id: fallbackId,
      name: `config_${fallbackId}`,
      active: true,
      isSelected: true
    });
  }
}
```

### 5. **Cache Management System**

**File: `backend_new/server.js`**
- Added `/backend/api/prosbc-instances/clear-cache` endpoint
- Frontend can clear backend credential cache when needed
- Helps resolve stale session issues

### 6. **UI Improvements**

**File: `frontend/src/components/Sidebar.jsx`**
- Added refresh button for manual config reload
- Better error messaging with retry buttons
- Loading indicators during config fetching

## Testing

A test script has been created to verify the fixes work correctly:

**File: `test-ubuntu-config-fix.js`**

To run the test:

```bash
export TEST_TOKEN="your_dashboard_token_here"
export BACKEND_URL="http://your-ubuntu-server:3000"
node test-ubuntu-config-fix.js
```

## Deployment Notes

### For Ubuntu Deployments:

1. **Ensure proper network connectivity** between the backend and ProSBC servers
2. **Monitor backend logs** for config fetching issues using the enhanced logging
3. **Set appropriate timeouts** if your ProSBC servers are slow to respond
4. **Test the retry mechanism** by temporarily disconnecting network during config loading

### Environment Variables:

Ensure these are properly set in your Ubuntu environment:

```bash
PROSBC_BASE_URL=https://your-prosbc-server
PROSBC_USERNAME=your_username
PROSBC_PASSWORD=your_password
JWT_SECRET=your_secret_key
```

## Monitoring and Troubleshooting

### Frontend Console Logs:
- `[Sidebar]` - Config fetching and retry logic
- `[ProSBCInstanceContext]` - Instance persistence and selection
- `[useInstanceRefresh]` - Instance change triggers

### Backend Logs:
- `[test-configs]` - Config endpoint processing
- `[Config Fetcher]` - HTML parsing and config extraction
- `[ProSBC Login]` - Authentication process

### Common Issues and Solutions:

1. **"No configs available" message:**
   - Click the refresh button (↻) in the Active Configuration section
   - Check backend logs for HTML parsing errors
   - Verify ProSBC server connectivity

2. **Instance selection not persisting:**
   - Check browser localStorage for `prosbc_selected_instance_id`
   - Ensure the instance ID exists in the database

3. **Intermittent config loading:**
   - This is normal and handled by the retry mechanism
   - Monitor backend logs for retry attempts
   - Consider increasing retry delays for slow networks

## Files Modified

### Frontend:
- `src/contexts/ProSBCInstanceContext.jsx` - Instance persistence
- `src/components/Sidebar.jsx` - Config fetching and retry logic
- `src/App.jsx` - Logout cleanup

### Backend:
- `server.js` - Test-configs endpoint with retry logic
- `utils/prosbc/prosbcConfigLiveFetcher.js` - Enhanced HTML parsing
- Added cache clearing endpoint

### New Files:
- `test-ubuntu-config-fix.js` - Testing script
- `UBUNTU_CONFIG_FIX.md` - This documentation
