import React, { useState, useEffect } from 'react';
import {
  getRoutesetMappings,
  generateRoutingDatabase,
  activateConfiguration,
  getAvailableConfigurations,
  validateConfiguration
} from '../utils/routesetMappingService';

const ActivationGeneration = ({ onAuthError }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [mappings, setMappings] = useState([]);
  
  // Configuration management state
  const [configurations, setConfigurations] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(1);
  const [activating, setActivating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load configurations and mappings
      const [configsData, mappingsData] = await Promise.all([
        getAvailableConfigurations().catch(err => {
          console.log('Could not load configurations:', err.message);
          return [];
        }),
        getRoutesetMappings().catch(err => {
          console.log('Could not load mappings:', err.message);
          return [];
        })
      ]);
      
      setConfigurations(configsData);
      setMappings(mappingsData);
      
      // Set the currently selected configuration
      const activeConfig = configsData.find(config => config.isSelected);
      if (activeConfig) {
        setSelectedConfig(activeConfig.id);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
      
      if (err.message.includes('Authentication failed')) {
        onAuthError && onAuthError();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleActivateConfiguration = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to activate configuration "${configurations.find(c => c.id === selectedConfig)?.name}"? This will apply the configuration to the system.`
    );
    
    if (!confirmed) return;
    
    try {
      setActivating(true);
      setError(null);
      setSuccessMessage('');
      
      console.log('Activating configuration:', selectedConfig);
      const result = await activateConfiguration(selectedConfig);
      
      if (result.success) {
        setSuccessMessage(result.message || 'Configuration activated successfully');
        console.log('Activation completed successfully:', result);
        
        // Reload configurations to get updated state
        try {
          const configsData = await getAvailableConfigurations();
          setConfigurations(configsData);
        } catch (reloadError) {
          console.log('Could not reload configurations:', reloadError.message);
        }
      } else {
        throw new Error(result.message || 'Configuration activation failed');
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error activating configuration:', err);
      
      let errorMessage = err.message;
      
      if (err.message.includes('timeout')) {
        errorMessage = 'Activation request timed out. The process may still be running on the server. Please check the system status.';
      } else if (err.message.includes('Authentication failed')) {
        errorMessage = 'Authentication failed. Please refresh the page and try again.';
        if (onAuthError) {
          onAuthError();
        }
      } else if (err.message.includes('Network Error')) {
        errorMessage = 'Network error occurred. Please check your connection and try again.';
      }
      
      setError(errorMessage);
    } finally {
      setActivating(false);
    }
  };

  const handleValidateConfiguration = async () => {
    try {
      setValidating(true);
      setError(null);
      setSuccessMessage('');
      
      console.log('Validating configuration:', selectedConfig);
      const result = await validateConfiguration(selectedConfig);
      
      if (result.success) {
        setSuccessMessage(result.message || 'Configuration validation completed');
        console.log('Validation completed successfully:', result);
        
        // If there's response data, log it for debugging
        if (result.response) {
          console.log('Validation response:', result.response);
        }
      } else {
        throw new Error(result.message || 'Configuration validation failed');
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error validating configuration:', err);
      
      let errorMessage = err.message;
      
      if (err.message.includes('Authentication failed')) {
        errorMessage = 'Authentication failed. Please refresh the page and try again.';
        if (onAuthError) {
          onAuthError();
        }
      }
      
      setError(errorMessage);
    } finally {
      setValidating(false);
    }
  };

  const handleGenerateDatabase = async () => {
    const confirmed = window.confirm(
      'This will delete and recreate the routing table with the mapped routesets csv files. Are you sure?'
    );
    
    if (!confirmed) return;
    
    try {
      setGenerating(true);
      setError(null);
      setSuccessMessage('');
      
      console.log('Starting routing database generation...');
      const result = await generateRoutingDatabase();
      
      if (result.success) {
        setSuccessMessage(result.message || 'Route database was generated successfully');
        console.log('Generation completed successfully:', result);
        
        // If there's response data, log it for debugging
        if (result.response) {
          console.log('Server response:', result.response);
        }
      } else {
        throw new Error(result.message || 'Generation failed with unknown error');
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error generating database:', err);
      
      // Provide more specific error messages
      let errorMessage = err.message;
      
      if (err.message.includes('timeout')) {
        errorMessage = 'Generation request timed out. The process may still be running on the server. Please check the routing database status.';
      } else if (err.message.includes('Authentication failed')) {
        errorMessage = 'Authentication failed. Please refresh the page and try again.';
        if (onAuthError) {
          onAuthError();
        }
      } else if (err.message.includes('Network Error')) {
        errorMessage = 'Network error occurred. Please check your connection and try again.';
      }
      
      setError(errorMessage);
      
      // Clear error message after 10 seconds for timeout errors
      if (err.message.includes('timeout')) {
        setTimeout(() => setError(null), 10000);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading activation and generation data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Activation and Generation</h2>
        <p className="text-gray-600">Manage configuration activation and routing database generation</p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-green-800">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Configuration Activation Section */}
      {configurations.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Configuration Activation</h3>
            <p className="text-sm text-gray-600 mt-1">Validate and activate system configurations</p>
          </div>
          
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Configuration Selection */}
              <div className="flex-1">
                <label htmlFor="config-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Configuration
                </label>
                <select
                  id="config-select"
                  value={selectedConfig}
                  onChange={(e) => setSelectedConfig(parseInt(e.target.value))}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={activating || validating || generating}
                >
                  {configurations.map(config => (
                    <option key={config.id} value={config.id}>
                      {config.name} {config.isSelected ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
                
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Configuration Details</h4>
                  <div className="text-sm text-blue-700">
                    <p><strong>Selected:</strong> {configurations.find(c => c.id === selectedConfig)?.name || 'None'}</p>
                    <p><strong>Status:</strong> {configurations.find(c => c.id === selectedConfig)?.isSelected ? 'Currently Active' : 'Inactive'}</p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col gap-4">
                <button
                  onClick={handleValidateConfiguration}
                  disabled={validating || activating || generating}
                  className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {validating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Validating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Validate Configuration
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleActivateConfiguration}
                  disabled={activating || validating || generating}
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {activating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Activating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Activate Configuration
                    </>
                  )}
                </button>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Instructions</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• <strong>Validate:</strong> Check the configuration for errors without applying changes</p>
                <p>• <strong>Activate:</strong> Apply the selected configuration to the system</p>
                <p>• Only one configuration can be active at a time</p>
                <p>• Always validate before activating to prevent system issues</p>
              </div>
            </div>
          </div>
        </div>
      )}

    

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={loadData}
          disabled={loading || activating || validating || generating}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              Refreshing...
            </div>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ActivationGeneration;
