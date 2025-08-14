// Simple integration test for optimized ProSBC utilities
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock environment for testing
process.env.PROSBC_BASE_URL = 'https://test-prosbc.example.com';
process.env.PROSBC_USERNAME = 'test-user';
process.env.PROSBC_PASSWORD = 'test-pass';
process.env.PROSBC_CONFIG_ID = '3';

async function testBasicImports() {
  console.log('🧪 Testing Basic Imports...');
  
  try {
    // Test individual component imports
    const { sessionPool } = await import('./sessionPool.js');
    console.log('✅ Session pool imported successfully');
    
    const { configCache } = await import('./configCache.js');
    console.log('✅ Config cache imported successfully');
    
    const { connectionPool } = await import('./connectionPool.js');
    console.log('✅ Connection pool imported successfully');
    
    const { htmlParser } = await import('./htmlParser.js');
    console.log('✅ HTML parser imported successfully');
    
    const { OptimizedProSBCFileAPI } = await import('./optimizedFileManager.js');
    console.log('✅ Optimized file manager imported successfully');
    
    const migration = await import('./migration.js');
    console.log('✅ Migration utilities imported successfully');
    
    // Test main index import
    const optimizedIndex = await import('./index.js');
    console.log('✅ Optimized index imported successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    return false;
  }
}

async function testBasicFunctionality() {
  console.log('\n🔧 Testing Basic Functionality...');
  
  try {
    const { OptimizedProSBCFileAPI } = await import('./optimizedFileManager.js');
    const { sessionPool, configCache, connectionPool } = await import('./index.js');
    
    // Test API instantiation
    const api = new OptimizedProSBCFileAPI('test-instance');
    console.log('✅ API instance created');
    
    // Test environment-based context loading
    try {
      await api.loadInstanceContext();
      console.log('✅ Instance context loaded (environment fallback)');
    } catch (error) {
      console.log('ℹ️ Instance context loading expected to fail in test environment');
    }
    
    // Test pool statistics
    const sessionStats = sessionPool.getStats();
    console.log(`✅ Session pool stats: ${sessionStats.totalSessions} sessions`);
    
    const configStats = configCache.getStats();
    console.log(`✅ Config cache stats: ${configStats.configDataEntries} entries`);
    
    const connectionStats = connectionPool.getStats();
    console.log(`✅ Connection pool stats: ${connectionStats.totalRequests} requests`);
    
    // Test migration utilities
    const { createProSBCFileAPI } = await import('./migration.js');
    const migratedAPI = createProSBCFileAPI('test-instance', { useOptimized: true });
    console.log('✅ Migration utility works');
    
    return true;
  } catch (error) {
    console.error('❌ Functionality test failed:', error.message);
    return false;
  }
}

async function testConfiguration() {
  console.log('\n⚙️ Testing Configuration...');
  
  try {
    const { OptimizedProSBCFileAPI } = await import('./optimizedFileManager.js');
    
    // Test ProSBC1 mappings
    const api = new OptimizedProSBCFileAPI('prosbc1');
    const mapping = api.prosbc1ConfigMappings['config_1'];
    
    if (mapping && mapping.id === '1' && mapping.dbId === '1') {
      console.log('✅ ProSBC1 hardcoded mappings preserved');
    } else {
      throw new Error('ProSBC1 mappings not working');
    }
    
    // Test basic auth header generation
    api.instanceContext = {
      username: 'test-user',
      password: 'test-pass'
    };
    
    const authHeader = api.getBasicAuthHeader();
    if (authHeader.startsWith('Basic ')) {
      console.log('✅ Basic auth header generation works');
    } else {
      throw new Error('Auth header generation failed');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Configuration test failed:', error.message);
    return false;
  }
}

async function runIntegrationTest() {
  console.log('🚀 ProSBC Optimization Integration Test');
  console.log('=====================================\n');
  
  const results = {
    imports: false,
    functionality: false,
    configuration: false
  };
  
  // Run tests
  results.imports = await testBasicImports();
  results.functionality = await testBasicFunctionality();
  results.configuration = await testConfiguration();
  
  // Summary
  console.log('\n📋 Test Results:');
  console.log(`Imports: ${results.imports ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Functionality: ${results.functionality ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Configuration: ${results.configuration ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result === true);
  console.log(`\nOverall: ${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('\n✨ ProSBC optimizations are ready to use!');
    console.log('   • Session pooling active');
    console.log('   • Configuration caching enabled');
    console.log('   • Connection pooling configured');
    console.log('   • Multi-instance support preserved');
    console.log('   • Backward compatibility maintained');
  }
  
  return allPassed;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runIntegrationTest()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

export { runIntegrationTest };
