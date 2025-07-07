// Emergency DM Save Debug Tool
// Run this in browser console to diagnose the save issue

window.emergencyDMDebug = function() {
    console.log('🚨 EMERGENCY DM SAVE DEBUG STARTED');
    
    // Step 1: Check if we're in the CSV editor
    const csvEditor = document.querySelector('[class*="csv"], [class*="CSV"], [class*="editor"]');
    console.log('📋 CSV Editor element found:', !!csvEditor);
    
    // Step 2: Find all save buttons
    const allButtons = document.querySelectorAll('button');
    const saveButtons = Array.from(allButtons).filter(btn => 
        btn.textContent.includes('Save') || 
        btn.textContent.includes('Upload') ||
        btn.textContent.includes('ProSBC')
    );
    
    console.log('🔘 All save-related buttons found:', saveButtons.length);
    saveButtons.forEach((btn, i) => {
        console.log(`Button ${i + 1}:`, btn.textContent.trim(), btn);
    });
    
    // Step 3: Check for React/component state
    const reactElements = document.querySelectorAll('[data-reactroot], [class*="react"]');
    console.log('⚛️ React elements found:', reactElements.length);
    
    // Step 4: Monitor network requests
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        console.log('🌐 FETCH REQUEST:', args[0], args[1]);
        return originalFetch.apply(this, arguments);
    };
    
    // Step 5: Monitor button clicks
    if (saveButtons.length > 0) {
        saveButtons.forEach((btn, i) => {
            btn.addEventListener('click', function(e) {
                console.log(`🖱️ SAVE BUTTON ${i + 1} CLICKED:`, btn.textContent.trim());
                console.log('Event:', e);
                console.log('Button element:', btn);
            });
        });
        console.log('✅ Click monitors attached to save buttons');
    }
    
    // Step 6: Check for errors
    window.addEventListener('error', function(e) {
        console.error('🚨 JAVASCRIPT ERROR:', e.error);
    });
    
    console.log(`
🧪 Debug monitors are now active!

Next steps:
1. Try clicking the save button
2. Watch for console messages
3. Check if you see any of these:
   - 🖱️ SAVE BUTTON CLICKED
   - 🌐 FETCH REQUEST
   - 🚨 JAVASCRIPT ERROR
   - Any 🚀 or 🎯 messages

If you don't see any click/fetch messages, the button click handler is not working.
    `);
};

// Auto-run the debug
emergencyDMDebug();

// Additional helper functions
window.findSaveButton = function() {
    const buttons = document.querySelectorAll('button');
    return Array.from(buttons).find(btn => 
        btn.textContent.includes('Save') && btn.textContent.includes('ProSBC')
    );
};

window.triggerSaveManually = function() {
    const saveBtn = findSaveButton();
    if (saveBtn) {
        console.log('🔧 Manually triggering save button click');
        saveBtn.click();
    } else {
        console.error('❌ Save button not found');
    }
};

console.log('🛠️ Emergency DM Debug Tool Loaded!');
console.log('- emergencyDMDebug() - Start comprehensive debugging');
console.log('- findSaveButton() - Find the save button');
console.log('- triggerSaveManually() - Manually click save button');
