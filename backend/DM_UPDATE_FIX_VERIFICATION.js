/**
 * Emergency DM Update Fix Verification Tool
 * Paste this into browser console to verify the fix is working
 */

console.log('🔧 DM Update Fix Verification Tool Loaded');

// Function to monitor network requests
function monitorNetworkRequests() {
  console.log('🌐 Starting network request monitoring...');
  
  // Override fetch to log all requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const [url, options] = args;
    console.log('🚀 Fetch Request:', {
      url,
      method: options?.method || 'GET',
      headers: options?.headers,
      body: options?.body,
      timestamp: new Date().toISOString()
    });
    
    return originalFetch.apply(this, args).then(response => {
      console.log('✅ Fetch Response:', {
        url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: new Date().toISOString()
      });
      return response;
    }).catch(error => {
      console.error('❌ Fetch Error:', {
        url,
        error: error.message,
        timestamp: new Date().toISOString()
      });
      throw error;
    });
  };
  
  console.log('✅ Network monitoring active - all fetch requests will be logged');
}

// Function to check current file info
function checkCurrentFileInfo() {
  console.log('📋 Checking current file info...');
  
  // Try to find React component with file info
  const csvEditor = document.querySelector('[class*="csv"]');
  if (csvEditor) {
    console.log('🎯 Found CSV editor element');
    
    // Try to access React props
    const reactKey = Object.keys(csvEditor).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
    if (reactKey) {
      const reactInstance = csvEditor[reactKey];
      console.log('⚛️ React instance found');
      
      // Traverse to find file info
      let current = reactInstance;
      let depth = 0;
      while (current && depth < 10) {
        if (current.memoizedProps && current.memoizedProps.fileInfo) {
          console.log('📁 Current file info:', current.memoizedProps.fileInfo);
          break;
        }
        current = current.return || current.parent;
        depth++;
      }
    }
  }
}

// Function to test save button
function testSaveButton() {
  console.log('🔘 Testing save button...');
  
  const saveButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent.includes('Save and Upload') || btn.textContent.includes('Updating')
  );
  
  if (saveButton) {
    console.log('✅ Save button found:', saveButton);
    console.log('🎯 Button properties:', {
      disabled: saveButton.disabled,
      textContent: saveButton.textContent,
      className: saveButton.className,
      onclick: saveButton.onclick
    });
    
    // Check if button has click handler
    const reactKey = Object.keys(saveButton).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
    if (reactKey) {
      const reactInstance = saveButton[reactKey];
      console.log('⚛️ Button React props:', reactInstance.memoizedProps);
    }
    
    return saveButton;
  } else {
    console.warn('❌ Save button not found');
    return null;
  }
}

// Function to verify the fix
function verifyDMUpdateFix() {
  console.log('🎯 === DM UPDATE FIX VERIFICATION ===');
  
  monitorNetworkRequests();
  checkCurrentFileInfo();
  
  const saveButton = testSaveButton();
  
  if (saveButton && !saveButton.disabled) {
    console.log('🚨 READY TO TEST:');
    console.log('1. Make a small change to the CSV table');
    console.log('2. Click the "Save and Upload to ProSBC" button');
    console.log('3. Watch the console for network requests');
    console.log('4. You should see:');
    console.log('   - csvFileUpdateService.updateCSVFile() being called');
    console.log('   - POST request to /api/file_dbs/X/routesets_digitmaps/Y endpoint');
    console.log('   - Multipart form data with proper DM fields');
    console.log('');
    console.log('🔍 Expected network pattern for DM files:');
    console.log('   - POST /api/file_dbs/1/routesets_digitmaps/[ID]');
    console.log('   - Content-Type: multipart/form-data');
    console.log('   - Form fields: dataFile, filename, fileId, etc.');
  } else {
    console.warn('⚠️ Save button is disabled or not found. Make some changes first.');
  }
}

// Auto-run verification
verifyDMUpdateFix();

// Export functions for manual use
window.dmFixVerification = {
  monitorNetworkRequests,
  checkCurrentFileInfo,
  testSaveButton,
  verifyDMUpdateFix
};

console.log('🎯 Type dmFixVerification.verifyDMUpdateFix() to run verification again');
