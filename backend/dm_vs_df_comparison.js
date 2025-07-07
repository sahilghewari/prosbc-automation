// DM vs DF File Update Comparison Test
// Copy and paste this in the browser console to compare the update processes

window.compareDMvsDF = function() {
  console.log('🔍 DM vs DF File Update Comparison Test');
  
  // This will help you verify that DM files are being processed differently from DF files
  
  console.group('📋 Expected Behavior for DM Files');
  console.log('✅ File Type should be: "routesets_digitmaps"');
  console.log('✅ Endpoint should be: /api/file_dbs/1/routesets_digitmaps/[ID]');
  console.log('✅ Form field should be: tbgw_routesets_digitmap[file]');
  console.log('✅ ID field should be: tbgw_routesets_digitmap[id]');
  console.log('✅ DB ID field should be: tbgw_routesets_digitmap[tbgw_files_db_id]');
  console.groupEnd();

  console.group('❌ Wrong Behavior (DF fields used for DM files)');
  console.log('❌ File Type: "routesets_definitions" (should be routesets_digitmaps)');
  console.log('❌ Endpoint: /api/file_dbs/1/routesets_definitions/[ID] (should be routesets_digitmaps)');
  console.log('❌ Form field: tbgw_routesets_definition[file] (should be tbgw_routesets_digitmap[file])');
  console.log('❌ ID field: tbgw_routesets_definition[id] (should be tbgw_routesets_digitmap[id])');
  console.groupEnd();

  console.log(`
🧪 To test this:
1. Open a DM file in the CSV editor
2. Make a change and click save
3. Check the console logs for the form field names
4. Check the Network tab for the endpoint URL
5. Verify the form data contains the correct field names

🎯 Key things to verify:
- Console log should show: "🎯 Preparing DM file form data"
- Network request URL should contain: "routesets_digitmaps"
- Form data should contain: "tbgw_routesets_digitmap[file]"
  `);
};

// Utility function to inspect file objects
window.inspectFileObject = function(fileObj) {
  console.group('🔍 File Object Inspector');
  console.log('ID:', fileObj?.id);
  console.log('Name:', fileObj?.name);
  console.log('Type:', fileObj?.type);
  console.log('File Type:', fileObj?.fileType);
  console.log('ProSBC ID:', fileObj?.prosbcId);
  console.log('Routeset ID:', fileObj?.routesetId);
  console.log('File DB ID:', fileObj?.fileDbId);
  console.log('Source:', fileObj?.source);
  console.log('Is Digit Map?', fileObj?.fileType === 'routesets_digitmaps');
  console.log('Full Object:', fileObj);
  console.groupEnd();
};

// Load the comparison tool
compareDMvsDF();

console.log('🛠️ DM vs DF Comparison Tool Loaded!');
console.log('Run compareDMvsDF() to see the expected vs actual behavior');
console.log('Run inspectFileObject(yourFileObject) to inspect any file object');
