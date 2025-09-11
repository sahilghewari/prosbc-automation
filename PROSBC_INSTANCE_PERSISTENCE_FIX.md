# ProSBC Instance Persistence Fix

## Problem Description

When users logged out and logged back in to the ProSBC automation system, the ProSBC 1 instance would load but its configurations wouldn't load properly. This was due to several issues:

1. **No ProSBC instance persistence**: Selected instance wasn't saved across logout/login cycles
2. **Session state not properly managed**: ProSBC session cookies weren't cleared on logout or re-established on login
3. **Credentials cache issues**: Backend credentials cache could become stale
4. **Error handling gaps**: Config fetching failed silently without proper error reporting

## Solution Overview

The fix implements a comprehensive solution that addresses all aspects of the problem:

### 1. Instance Persistence (`frontend/src/contexts/ProSBCInstanceContext.jsx`)

- **localStorage persistence**: Selected ProSBC instance ID is saved to `localStorage` and restored on login
- **Auto-selection logic**: Attempts to restore previously selected instance, falls back to first active instance
- **Clear on logout**: Instance selection is properly cleared when user logs out

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

### 2. Session Management (`frontend/src/App.jsx`)

- **ProSBC session clearing**: ProSBC session cookies are cleared on logout using `sessionManager.clearSession()`
- **Integrated logout flow**: Combines dashboard token removal, instance clearing, and session clearing

```javascript
const handleLogout = () => {
  localStorage.removeItem('dashboard_token');
  clearInstanceSelection(); // Clear ProSBC instance selection
  sessionManager.clearSession(); // Clear ProSBC session cookies
  setIsDashboardAuth(false);
  setShowLoginModal(false);
};
```

### 3. Backend Credentials Cache Management

- **Cache clearing endpoint**: New endpoint to clear backend credentials cache when needed
- **Automatic cache clearing**: Frontend can trigger cache clearing during logout or instance changes

```javascript
// backend_new/server.js
app.post('/backend/api/prosbc-instances/clear-cache', async (req, res) => {
  try {
    const { instanceId } = req.body;
    const { clearCredentialsCache } = await import('./utils/prosbc/multiInstanceManager.js');
    
    clearCredentialsCache(instanceId);
    
    res.json({ 
      success: true, 
      message: instanceId ? `Cache cleared for instance ${instanceId}` : 'All cache cleared'
    });
  } catch (err) {
    console.error('[clear-cache] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});
```

### 4. Improved Config Fetching (`frontend/src/components/Sidebar.jsx`)

- **Better error handling**: Configs are properly cleared on fetch errors
- **Response validation**: Checks for both HTTP errors and application-level errors
- **Session establishment delay**: Adds small delay when instance changes to allow ProSBC session setup
- **Comprehensive logging**: Enhanced logging for debugging config loading issues

```javascript
// Add a small delay to ensure ProSBC session is ready
if (instance && instance !== selectedInstance) {
  console.log('[Sidebar] Instance changed, waiting 1s for session establishment...');
  await new Promise(resolve => setTimeout(resolve, 1000));
}

const res = await fetch('/backend/api/prosbc-files/test-configs', { headers });

if (!res.ok) {
  throw new Error(`HTTP ${res.status}: ${res.statusText}`);
}

const data = await res.json();

// Check if the response indicates an error
if (!data.success) {
  throw new Error(data.error || 'Failed to fetch configs');
}
```

## Files Modified

### Frontend Files
- `frontend/src/contexts/ProSBCInstanceContext.jsx` - Added instance persistence and cache clearing
- `frontend/src/App.jsx` - Enhanced logout flow with session clearing
- `frontend/src/components/Sidebar.jsx` - Improved config fetching with better error handling

### Backend Files
- `backend_new/server.js` - Added credentials cache clearing endpoint

## Testing

A test script `test-prosbc-instance-persistence.js` was created to verify:

1. Instance fetching functionality
2. Config loading with instance headers
3. Credentials cache clearing
4. Config loading after cache clear

Run the test with:
```bash
node test-prosbc-instance-persistence.js
```

## Manual Testing Steps

1. **Login** to the frontend application
2. **Select a ProSBC instance** from the instance selector
3. **Verify configs load** properly in the sidebar
4. **Logout** from the application
5. **Login again** to the application
6. **Verify the same instance is auto-selected** (persistence working)
7. **Verify configs load properly again** (session management working)

## Expected Behavior After Fix

- ✅ ProSBC instance selection persists across logout/login cycles
- ✅ Configurations load properly after re-login
- ✅ ProSBC sessions are properly managed (cleared on logout, re-established on login)
- ✅ Backend credentials cache is cleared when needed
- ✅ Error handling provides clear feedback when config loading fails
- ✅ No silent failures in config fetching

## Benefits

1. **Improved User Experience**: Users don't need to re-select their ProSBC instance after every login
2. **Reliable Config Loading**: Configurations consistently load regardless of login/logout cycles
3. **Better Error Visibility**: Clear error messages when config loading fails
4. **Session Hygiene**: Proper cleanup of session state prevents stale authentication issues
5. **Cache Management**: Prevents issues caused by stale credentials cache

## Future Enhancements

1. **Instance-specific config persistence**: Remember which config was selected for each instance
2. **Connection health monitoring**: Real-time monitoring of ProSBC instance connectivity
3. **Automatic retry mechanisms**: Retry config loading with exponential backoff on failures
4. **Multi-tab session sync**: Synchronize instance selection across multiple browser tabs
