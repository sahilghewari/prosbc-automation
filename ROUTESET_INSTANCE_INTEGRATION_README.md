# ProSBC Instance-Aware Routeset Mapping Implementation

## Overview

This implementation enables the Routeset Mapping functionality to automatically refresh and display mappings when a different ProSBC instance is selected. The changes maintain backward compatibility while adding full multi-instance support.

## Changes Made

### Backend Changes

#### 1. Route Layer (`backend_new/routes/routesetMapping.js`)
- **Updated all route handlers** to accept instance identification via:
  - HTTP header: `X-ProSBC-Instance-ID`
  - Query parameter: `instanceId`
  - Query parameter: `configId` (defaults to 'config_1')

**Modified Routes:**
- `GET /api/routeset-mapping/mappings`
- `GET /api/routeset-mapping/nap-edit-data/:napName`
- `GET /api/routeset-mapping/files`
- `GET /api/routeset-mapping/available-files`

#### 2. Service Layer (`backend_new/utils/prosbc/routesetMappingService.js`)
- **Multi-instance session management**: Separate session cookies for each ProSBC instance
- **Updated core functions** to accept `instanceId` parameter:
  - `getRoutesetMappings(configId, instanceId)`
  - `getNapEditData(napName, configId, instanceId)`
  - `getAvailableFiles(configId, instanceId)`
- **Enhanced API client creation** with instance context support
- **Session caching** per instance to optimize performance

### Frontend Changes

#### 1. RoutesetMapping Component (`frontend/src/components/RoutesetMapping.jsx`)
- **ProSBC Instance Context Integration**:
  - Imports `useProSBCInstance` hook
  - Registers for instance change callbacks
  - Shows instance selection status in UI
- **Auto-refresh Functionality**:
  - Automatically reloads mappings when instance changes
  - Displays "No ProSBC instance selected" state
  - Shows current instance name in header
- **Enhanced Headers**: Includes instance-specific headers in all API calls

#### 2. Service Layer (`frontend/src/utils/routesetMappingService.js`)
- **Instance Header Support**: Automatically includes `X-ProSBC-Instance-ID` header
- **Global Instance Detection**: Uses `window.__prosbc_instance_id` as fallback

### Multi-Instance Manager Integration
- **Leverages existing `multiInstanceManager.js`** for instance context
- **Maintains backward compatibility** with environment variables
- **Automatic credential caching** per instance

## Key Features

### 1. Automatic Refresh
When a user changes the ProSBC instance:
1. Frontend detects the change via context callback
2. Automatically calls `loadMappings()` with new instance
3. Backend uses appropriate instance credentials
4. UI updates to show new instance's routeset mappings

### 2. Visual Instance Indication
- **Header shows current instance name** and base URL
- **Warning badge** when no instance is selected
- **Instance-specific state management**

### 3. Backward Compatibility
- **Existing single-instance setups** continue to work unchanged
- **Environment variable fallback** for credentials
- **Default instance handling** when no instance ID provided

### 4. Error Handling
- **Graceful degradation** when instance is unavailable
- **Clear error messages** for authentication failures
- **Instance-specific session management**

## API Usage

### Backend Route Examples
```javascript
// Get mappings for specific instance
GET /backend/api/routeset-mapping/mappings
Headers: {
  "X-ProSBC-Instance-ID": "instance_1",
  "Authorization": "Bearer <token>"
}

// Query parameter alternative
GET /backend/api/routeset-mapping/mappings?instanceId=instance_1&configId=config_2
```

### Frontend Integration
```jsx
// Component automatically receives instance context
const { selectedInstanceId, selectedInstance, registerRefreshCallback } = useProSBCInstance();

// Register for instance change notifications
useEffect(() => {
  const unregister = registerRefreshCallback((instanceId, instance) => {
    loadMappings(); // Refresh data for new instance
  });
  return unregister;
}, []);
```

## Testing

### Manual Testing Steps
1. **Navigate to Routeset Mapping page**
2. **Select different ProSBC instances** from instance selector
3. **Verify mappings refresh automatically** for each instance
4. **Check instance name display** in page header
5. **Test with no instance selected** (should show warning state)

### Automated Testing
Run the provided test script:
```bash
node test_routeset_instance_integration.js
```

## Implementation Benefits

### 1. Seamless User Experience
- **No manual refresh required** when switching instances
- **Clear visual feedback** about current instance
- **Consistent behavior** across all ProSBC-related functionality

### 2. Developer Benefits
- **Minimal code changes** to existing functionality
- **Reusable pattern** for other ProSBC integrations
- **Centralized instance management**

### 3. Scalability
- **Multiple instance support** without performance impact
- **Session caching** reduces authentication overhead
- **Flexible credential management**

## Configuration

### Environment Variables (Backward Compatibility)
```env
PROSBC_BASE_URL=https://your-prosbc-server.com
PROSBC_USERNAME=your-username
PROSBC_PASSWORD=your-password
```

### Database-Managed Instances
- Instances are managed via the ProSBC Instance Manager
- Each instance has its own credentials and configuration
- Automatic discovery and credential management

## Future Enhancements

### 1. Real-time Updates
- WebSocket integration for live mapping changes
- Multi-user collaboration features

### 2. Batch Operations
- Cross-instance mapping comparisons
- Bulk configuration deployment

### 3. Advanced Filtering
- Instance-specific filter persistence
- Global vs. instance-specific views

## Troubleshooting

### Common Issues
1. **"No ProSBC instance selected"**: Ensure instance selector has active instances
2. **Authentication errors**: Verify instance credentials in database
3. **Mapping not refreshing**: Check browser console for JavaScript errors

### Debug Information
- Backend logs include instance context in all operations
- Frontend console logs show instance change events
- Network tab shows instance headers in API calls

---

This implementation provides a robust foundation for multi-instance ProSBC management while maintaining the simplicity and reliability of the existing single-instance workflow.
