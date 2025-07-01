import React, { useState } from 'react';
import { 
  createSimpleNap, 
  createSipProxyNap, 
  validateNapData, 
  checkNapExists,
  fetchExistingNaps 
} from '../utils/napApiClientFixed';

function NapTester() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [testNapName, setTestNapName] = useState('TEST_NAP_' + Date.now());

  const runTest = async (testType) => {
    setIsLoading(true);
    setMessage(`Running ${testType} test...`);
    
    try {
      let result;
      
      switch (testType) {
        case 'simple':
          result = await createSimpleNap(testNapName);
          break;
          
        case 'proxy':
          const proxyConfig = {
            name: testNapName,
            enabled: true,
            proxy_address: '192.168.1.100',
            proxy_port: '5060'
          };
          result = await createSipProxyNap(proxyConfig);
          break;
          
        case 'validate':
          const testConfig = {
            name: testNapName,
            proxy_address: 'invalid-ip',
            proxy_port: '99999'
          };
          const validation = validateNapData(testConfig);
          setMessage(`Validation result:\nValid: ${validation.isValid}\nErrors: ${validation.errors.join(', ')}\nWarnings: ${validation.warnings.join(', ')}`);
          setIsLoading(false);
          return;
          
        case 'check':
          const exists = await checkNapExists(testNapName);
          setMessage(`NAP "${testNapName}" exists: ${exists}`);
          setIsLoading(false);
          return;
          
        case 'list':
          const naps = await fetchExistingNaps();
          const napNames = Object.keys(naps).filter(name => name !== '***meta***');
          setMessage(`Found ${napNames.length} NAPs:\n${napNames.join('\n')}`);
          setIsLoading(false);
          return;
          
        default:
          setMessage('Unknown test type');
          setIsLoading(false);
          return;
      }
      
      if (result.success) {
        setMessage(`✅ ${testType} test successful: ${result.message}`);
        if (result.napId) {
          setMessage(prev => prev + `\nNAP ID: ${result.napId}`);
        }
      } else {
        setMessage(`❌ ${testType} test failed: ${result.message}`);
      }
      
    } catch (error) {
      setMessage(`❌ ${testType} test error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">NAP API Tester</h1>
          
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Test NAP Name</label>
            <input
              type="text"
              value={testNapName}
              onChange={(e) => setTestNapName(e.target.value)}
              className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
              placeholder="Enter NAP name for testing"
            />
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => runTest('simple')}
              disabled={isLoading}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              Test Simple NAP
            </button>
            
            <button
              onClick={() => runTest('proxy')}
              disabled={isLoading}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors"
            >
              Test Proxy NAP
            </button>
            
            <button
              onClick={() => runTest('validate')}
              disabled={isLoading}
              className="px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 transition-colors"
            >
              Test Validation
            </button>
            
            <button
              onClick={() => runTest('check')}
              disabled={isLoading}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors"
            >
              Check Exists
            </button>
            
            <button
              onClick={() => runTest('list')}
              disabled={isLoading}
              className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
            >
              List NAPs
            </button>
            
            <button
              onClick={() => setTestNapName('TEST_NAP_' + Date.now())}
              disabled={isLoading}
              className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
            >
              New Name
            </button>
          </div>
          
          {message && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800 mb-2">Test Result:</h3>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">{message}</pre>
            </div>
          )}
          
          {isLoading && (
            <div className="flex items-center justify-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Running test...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NapTester;
