// DM File Update Debug Tool
// Copy and paste this in the browser console when you have the app open

window.testDMFileUpdate = async function() {
  console.log('🧪 Starting DM File Update Test');
  
  // Test file content
  const testCsvContent = `called,calling,routeset_name
8557021437,,sahil
8557021431,,sahil_modified
8339510169,,sahil_test
8339510170,,sahil
8339510171,,sahil
8339510172,,sahil_new`;

  // Test file info (update with actual values from your DM file)
  const testFileInfo = {
    id: 4, // Replace with actual DM file ID
    name: 'test_dm_file.csv',
    fileType: 'routesets_digitmaps',
    prosbcId: 4, // Replace with actual ProSBC ID
    routesetId: 4, // Replace with actual routeset ID
    fileDbId: 1,
    source: 'prosbc'
  };

  console.log('📋 Test parameters:', testFileInfo);
  console.log('📄 Test CSV content:', testCsvContent);

  try {
    // Import the CSV update service
    const csvFileUpdateService = (await import('./src/utils/csvFileUpdateService.js')).csvFileUpdateService;
    
    console.log('🔧 CSV Update Service loaded');

    // Progress callback
    const onProgress = (percent, message) => {
      console.log(`📊 ${percent}%: ${message}`);
    };

    // Perform the update
    console.log('🚀 Starting CSV file update...');
    const result = await csvFileUpdateService.updateCSVFile(
      testCsvContent,
      testFileInfo,
      onProgress
    );

    console.log('✅ Update result:', result);
    
    if (result.success) {
      console.log('🎉 DM File update successful!');
    } else {
      console.error('❌ DM File update failed:', result);
    }

  } catch (error) {
    console.error('💥 Error during test:', error);
    console.group('📋 Error Details');
    console.log('Error message:', error.message);
    console.log('Error stack:', error.stack);
    console.groupEnd();
  }
};

// Manual steps to test DM file update:
console.log(`
🧪 DM File Update Test Tool Loaded!

To test DM file updates:

1. First, find a DM file ID by checking the console logs when you load files
2. Update the testFileInfo object in the testDMFileUpdate function with the correct IDs
3. Run: testDMFileUpdate()

Alternative manual test:
1. Open the CSV editor for a DM file
2. Make a small change (add a row or modify a cell)
3. Click "Save and Upload to ProSBC"
4. Check the console for detailed logs

Look for these key log messages:
- 🎯 Processing pre-selected file
- 🚀 Starting CSV save operation for file
- 🎯 DM File Update - Validation Check
- 🔥 Performing CSV update with multipart/form-data
- 🌐 Calling fileManagementAPI.updateFile
- 🎯 Preparing DM file form data
- ✅ Update completed successfully
`);
