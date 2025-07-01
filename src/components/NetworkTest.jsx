import React, { useState } from 'react';
import NapEditService from '../utils/napEditService';

const NetworkTest = ({ baseUrl, sessionCookie }) => {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  const napEditService = new NapEditService(baseUrl, sessionCookie);

  const addResult = (test, status, details) => {
    setTestResults(prev => [...prev, { test, status, details, timestamp: new Date().toISOString() }]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    // Test 1: Basic connection
    try {
      addResult('Basic Connection', 'RUNNING', 'Testing network connectivity...');
      const canConnect = await napEditService.testConnection();
      addResult('Basic Connection', canConnect ? 'PASS' : 'FAIL', canConnect ? 'Connection successful' : 'Connection failed');
    } catch (error) {
      addResult('Basic Connection', 'FAIL', error.message);
    }

    // Test 2: Simple fetch to proxy
    try {
      addResult('Proxy Fetch', 'RUNNING', 'Testing direct fetch to proxy...');
      const response = await fetch(`${baseUrl}/`, {
        method: 'GET',
        credentials: 'include'
      });
      addResult('Proxy Fetch', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`);
    } catch (error) {
      addResult('Proxy Fetch', 'FAIL', error.message);
    }

    // Test 3: CORS preflight
    try {
      addResult('CORS Preflight', 'RUNNING', 'Testing CORS preflight...');
      const response = await fetch(`${baseUrl}/`, {
        method: 'OPTIONS',
        credentials: 'include'
      });
      addResult('CORS Preflight', response.ok ? 'PASS' : 'FAIL', `Status: ${response.status}`);
    } catch (error) {
      addResult('CORS Preflight', 'FAIL', error.message);
    }

    setIsRunning(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PASS': return 'text-green-600';
      case 'FAIL': return 'text-red-600';
      case 'RUNNING': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Network Diagnostics</h3>
      
      <button
        onClick={runTests}
        disabled={isRunning}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50 mb-4"
      >
        {isRunning ? 'Running Tests...' : 'Run Network Tests'}
      </button>

      <div className="space-y-2">
        {testResults.map((result, index) => (
          <div key={index} className="flex justify-between items-center p-2 border rounded">
            <span className="font-medium">{result.test}</span>
            <span className={`font-semibold ${getStatusColor(result.status)}`}>
              {result.status}
            </span>
            <span className="text-sm text-gray-600 max-w-md truncate">
              {result.details}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Base URL:</strong> {baseUrl}</p>
        <p><strong>Current URL:</strong> {window.location.href}</p>
        <p><strong>User Agent:</strong> {navigator.userAgent.substring(0, 100)}...</p>
      </div>
    </div>
  );
};

export default NetworkTest;
