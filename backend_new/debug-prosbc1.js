#!/usr/bin/env node

// Debug script specifically for ProSBC1 issues
import { createProSBCFileAPI } from './utils/prosbc/prosbcFileManager.js';

async function debugProSBC1() {
  console.log('='.repeat(80));
  console.log('ProSBC1 DEBUG ANALYSIS');
  console.log('='.repeat(80));
  
  try {
    // Create ProSBC1 file manager
    console.log('Creating ProSBC1 file manager...');
    const fileManager = await createProSBCFileAPI('ProSBC1');
    
    // Run comprehensive debug
    console.log('Running comprehensive configuration analysis...');
    const debugResult = await fileManager.debugProSBC1Configuration();
    
    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS COMPLETE');
    console.log('='.repeat(80));
    
    console.log(`\nSummary:`);
    console.log(`- Total Configurations: ${debugResult.totalConfigs}`);
    console.log(`- Accessible Database IDs: ${debugResult.accessibleDbs}`);
    console.log(`- Database IDs with Files: ${debugResult.dbsWithFiles}`);
    
    if (debugResult.totalConfigs > 10) {
      console.log(`\n⚠️  WARNING: ProSBC1 has ${debugResult.totalConfigs} configurations.`);
      console.log(`   This high number of configurations might be causing upload/verification issues.`);
      console.log(`   Consider investigating config selection logic.`);
    }
    
    // Test a simple file upload to see what happens
    console.log('\n' + '-'.repeat(40));
    console.log('TESTING FILE UPLOAD (create mode)');
    console.log('-'.repeat(40));
    
    try {
      // Test with create mode to avoid update conflicts
      const testFileName = `test_debug_${Date.now()}.csv`;
      const testContent = 'test,data\n1,value1\n2,value2\n';
      
      // Create temporary file
      const fs = await import('fs');
      const path = await import('path');
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempFilePath = path.join(tempDir, testFileName);
      fs.writeFileSync(tempFilePath, testContent);
      
      console.log(`Creating test file: ${testFileName}`);
      
      const uploadResult = await fileManager.uploadDfFile(
        tempFilePath,
        (percent, message) => console.log(`  ${percent}% - ${message}`),
        null, // configId (auto-select)
        testFileName,
        'create' // Force create mode
      );
      
      console.log('Upload result:', uploadResult);
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn('Could not clean up temp file:', cleanupError.message);
      }
      
    } catch (uploadError) {
      console.error('Upload test failed:', uploadError.message);
    }
    
  } catch (error) {
    console.error('Debug analysis failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  debugProSBC1().catch(console.error);
}

export default debugProSBC1;
