#!/usr/bin/env node

// Simple test to verify that all our instance-based utilities are properly structured
// without requiring database connections

console.log('🧪 Testing ProSBC Multi-Instance Utility Structure...\n');

async function testModuleImports() {
  console.log('📦 Testing module imports...');
  
  try {
    // Test importing the main utilities
    const { createProSBCFileAPI } = await import('./utils/prosbc/prosbcFileManager.js');
    const { createNapEditService } = await import('./utils/prosbc/napEditService.js');
    const { uploadDfFileByInstanceId, uploadDmFileByInstanceId } = await import('./utils/prosbc/fileUpload.js');
    const { fetchExistingNapsByInstance, createInstanceApiClient } = await import('./utils/prosbc/napApiClientFixed.js');
    
    console.log('✅ ProSBC File Manager: createProSBCFileAPI function available');
    console.log('✅ NAP Edit Service: createNapEditService function available');
    console.log('✅ File Upload: instance-specific upload functions available');
    console.log('✅ NAP API Client: instance-specific functions available');
    
  } catch (error) {
    console.error('❌ Module import failed:', error.message);
    return false;
  }
  
  return true;
}

async function testInstanceBasedCreation() {
  console.log('\n🏗️  Testing instance-based object creation...');
  
  try {
    const { createProSBCFileAPI } = await import('./utils/prosbc/prosbcFileManager.js');
    const { createNapEditService } = await import('./utils/prosbc/napEditService.js');
    
    // Test creating instance-specific objects (without DB calls)
    const fileAPI1 = createProSBCFileAPI(1);
    const fileAPI2 = createProSBCFileAPI(2);
    const napService1 = createNapEditService(1);
    const napService2 = createNapEditService(2);
    
    console.log('✅ Created ProSBC File API for instance 1');
    console.log('✅ Created ProSBC File API for instance 2');
    console.log('✅ Created NAP Edit Service for instance 1');
    console.log('✅ Created NAP Edit Service for instance 2');
    
    // Test that they have the expected properties
    if (fileAPI1.instanceId === 1 && fileAPI2.instanceId === 2) {
      console.log('✅ Instance IDs properly set');
    } else {
      console.log('❌ Instance IDs not properly set');
      return false;
    }
    
    if (napService1.instanceId === 1 && napService2.instanceId === 2) {
      console.log('✅ NAP service instance IDs properly set');
    } else {
      console.log('❌ NAP service instance IDs not properly set');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Instance creation failed:', error.message);
    return false;
  }
  
  return true;
}

async function testBackwardCompatibility() {
  console.log('\n🔄 Testing backward compatibility...');
  
  try {
    const { createProSBCFileAPI } = await import('./utils/prosbc/prosbcFileManager.js');
    const { createNapEditService } = await import('./utils/prosbc/napEditService.js');
    
    // Test creating objects without instance ID (should fall back to env vars)
    const defaultFileAPI = createProSBCFileAPI(); // No instance ID
    const defaultNapService = createNapEditService(); // No instance ID
    
    console.log('✅ Created default ProSBC File API (environment-based)');
    console.log('✅ Created default NAP Edit Service (environment-based)');
    
    // Verify they don't have instance IDs set
    if (defaultFileAPI.instanceId === null && defaultNapService.instanceId === null) {
      console.log('✅ Default instances properly configured for environment variables');
    } else {
      console.log('❌ Default instances should not have instance IDs set');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Backward compatibility test failed:', error.message);
    return false;
  }
  
  return true;
}

async function testFunctionSignatures() {
  console.log('\n📝 Testing function signatures...');
  
  try {
    const fileUpload = await import('./utils/prosbc/fileUpload.js');
    const napApi = await import('./utils/prosbc/napApiClientFixed.js');
    
    // Test that our new helper functions exist
    const expectedFunctions = [
      'uploadDfFileByInstanceId',
      'uploadDmFileByInstanceId'
    ];
    
    for (const funcName of expectedFunctions) {
      if (typeof fileUpload[funcName] === 'function') {
        console.log(`✅ File upload function: ${funcName}`);
      } else {
        console.log(`❌ Missing file upload function: ${funcName}`);
        return false;
      }
    }
    
    const expectedNapFunctions = [
      'fetchExistingNapsByInstance',
      'fetchDfFilesByInstance',
      'fetchDmFilesByInstance',
      'createInstanceApiClient'
    ];
    
    for (const funcName of expectedNapFunctions) {
      if (typeof napApi[funcName] === 'function') {
        console.log(`✅ NAP API function: ${funcName}`);
      } else {
        console.log(`❌ Missing NAP API function: ${funcName}`);
        return false;
      }
    }
    
  } catch (error) {
    console.error('❌ Function signature test failed:', error.message);
    return false;
  }
  
  return true;
}

async function runStructureTest() {
  console.log('🚀 Multi-ProSBC Instance Structure Verification\n');
  
  const tests = [
    testModuleImports,
    testInstanceBasedCreation,
    testBackwardCompatibility,
    testFunctionSignatures
  ];
  
  let allPassed = true;
  
  for (const test of tests) {
    const result = await test();
    if (!result) {
      allPassed = false;
      break;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 ALL STRUCTURE TESTS PASSED!');
    console.log('✅ Multi-instance ProSBC utilities are properly structured');
    console.log('✅ Backward compatibility maintained');
    console.log('✅ Instance-specific functions available');
    console.log('✅ Factory functions working correctly');
    console.log('\n📋 Summary of changes:');
    console.log('   • ProSBC File API now supports instanceId parameter');
    console.log('   • NAP Edit Service now supports instanceId parameter');
    console.log('   • File upload utilities have instance-specific helpers');
    console.log('   • NAP API client has instance-specific functions');
    console.log('   • All utilities maintain backward compatibility');
    console.log('   • Environment variable fallback still works');
  } else {
    console.log('❌ STRUCTURE TESTS FAILED!');
    console.log('Some utilities are not properly configured for multi-instance support.');
    process.exit(1);
  }
}

// Run the test
runStructureTest().catch(error => {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
});
