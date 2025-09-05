import React, { useState, useEffect } from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';


const ActivationGeneration = ({ onAuthError }) => {
  const { selectedInstance } = useProSBCInstance();
  
  // Helper to get auth headers with instance ID
  const getAuthHeaders = () => {
    const token = localStorage.getItem('dashboard_token');
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    
    // Add ProSBC instance header if an instance is selected
    if (selectedInstance?.id) {
      headers['X-ProSBC-Instance-ID'] = selectedInstance.id.toString();
    }
    
    return headers;
  };
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

  // Load initial data and reload when instance changes
  useEffect(() => {
    if (selectedInstance) {
      console.log(`[ActivationGeneration] Loading data for instance: ${selectedInstance.name} (${selectedInstance.id})`);
      loadData();
    }
  }, [selectedInstance]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(''); // Clear any previous messages when loading new data
      
      console.log(`[ActivationGeneration] Loading configurations and mappings for instance: ${selectedInstance?.name || 'default'}`);
      
      // Load configurations
      const configsRes = await fetch('/backend/api/routeset-mapping/configurations', { headers: getAuthHeaders() });
      if (!configsRes.ok) throw new Error(await configsRes.text());
      const configsJson = await configsRes.json();
      const configsArr = Array.isArray(configsJson.configurations) ? configsJson.configurations : [];
      setConfigurations(configsArr);
      
      // Set the currently selected configuration
      const activeConfig = configsArr.find(config => config.isSelected);
      if (activeConfig) {
        setSelectedConfig(activeConfig.id);
      }
      
      // Load mappings
      const mappingsRes = await fetch('/backend/api/routeset-mapping/mappings', { headers: getAuthHeaders() });
      if (!mappingsRes.ok) throw new Error(await mappingsRes.text());
      const mappingsJson = await mappingsRes.json();
      const mappingsArr = Array.isArray(mappingsJson.mappings) ? mappingsJson.mappings : [];
      setMappings(mappingsArr);
      
      console.log(`[ActivationGeneration] Loaded ${configsArr.length} configurations and ${mappingsArr.length} mappings`);
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
      const res = await fetch(`/backend/api/routeset-mapping/activate-configuration/${encodeURIComponent(selectedConfig)}`, { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      if (result.success) {
        setSuccessMessage(result.message || 'Configuration activated successfully');
        console.log('Activation completed successfully:', result);
        // Reload configurations to get updated state
        try {
          const configsRes = await fetch('/backend/api/routeset-mapping/configurations', { headers: getAuthHeaders() });
          if (!configsRes.ok) throw new Error(await configsRes.text());
          const configsJson = await configsRes.json();
          const configsArr = Array.isArray(configsJson.configurations) ? configsJson.configurations : [];
          setConfigurations(configsArr);
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
      const res = await fetch(`/backend/api/routeset-mapping/validate-configuration/${encodeURIComponent(selectedConfig)}`, { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      if (result.success) {
        setSuccessMessage(result.message || 'Configuration validation completed');
        console.log('Validation completed successfully:', result);
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
      const res = await fetch('/backend/api/routeset-mapping/generate-database', { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      if (result.success) {
        setSuccessMessage(result.message || 'Route database was generated successfully');
        console.log('Generation completed successfully:', result);
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
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            <p className="mt-2 text-gray-300">Loading activation and generation data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Activation and Generation</h2>
        <p className="text-gray-300">Manage configuration activation and routing database generation</p>
        
        {/* ProSBC Instance Indicator */}
        {selectedInstance && (
          <div className="mt-3 p-3 bg-blue-900/30 border border-blue-700 rounded-lg backdrop-blur-sm">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-blue-300">
                <strong>Active ProSBC:</strong> {selectedInstance.name}
                {selectedInstance.baseUrl && (
                  <span className="text-blue-400 ml-2">({selectedInstance.baseUrl})</span>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="mb-6 bg-green-900/30 border border-green-700 rounded-lg p-4 backdrop-blur-sm">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-green-300">{successMessage}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg p-4 backdrop-blur-sm">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-red-300">{error}</span>
          </div>
        </div>
      )}

      {/* Configuration Activation Section */}
      {configurations.length > 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl mb-6 backdrop-blur-sm">
          <div className="px-6 py-4 border-b border-gray-700">
            <h3 className="text-lg font-semibold text-white">Configuration Activation</h3>
            <p className="text-sm text-gray-300 mt-1">Validate and activate system configurations</p>
          </div>
          
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Configuration Selection */}
              <div className="flex-1">
                <label htmlFor="config-select" className="block text-sm font-medium text-gray-300 mb-2">
                  Select Configuration
                </label>
                <select
                  id="config-select"
                  value={selectedConfig}
                  onChange={(e) => setSelectedConfig(parseInt(e.target.value))}
                  className="block w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm bg-gray-700 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  disabled={activating || validating || generating}
                >
                  {configurations.map(config => (
                    <option key={config.id} value={config.id}>
                      {config.name} {config.isSelected ? '(Active)' : ''}
                    </option>
                  ))}
                </select>
                
                <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg backdrop-blur-sm">
                  <h4 className="text-sm font-medium text-blue-300 mb-2">Configuration Details</h4>
                  <div className="text-sm text-blue-200">
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
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {validating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
            
            <div className="mt-6 p-4 bg-gray-700 border border-gray-600 rounded-lg">
              <h4 className="text-sm font-medium text-white mb-2">Instructions</h4>
              <div className="text-sm text-gray-300 space-y-1">
                <p>• <strong>Validate:</strong> Check the configuration for errors without applying changes</p>
                <p>• <strong>Activate:</strong> Apply the selected configuration to the system</p>
                <p>• Only one configuration can be active at a time</p>
                <p>• Always validate before activating to prevent system issues</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Routing Database Generation Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl mb-6 backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Routing Database Generation</h3>
          <p className="text-sm text-gray-300 mt-1">Generate routing database from mapped routesets CSV files</p>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Information Panel */}
            <div className="flex-1">
              <div className="p-4 bg-amber-900/30 border border-amber-700 rounded-lg backdrop-blur-sm">
                <h4 className="text-sm font-medium text-amber-300 mb-2">⚠️ Important Notice</h4>
                <div className="text-sm text-amber-200 space-y-1">
                  <p>• This operation will <strong>delete and recreate</strong> the routing table</p>
                  <p>• All existing routing data will be replaced with mapped routesets</p>
                  <p>• Ensure routeset CSV files are properly mapped before proceeding</p>
                  <p>• This process may take several minutes to complete</p>
                </div>
              </div>
              
              {mappings.length > 0 && (
                <div className="mt-4 p-4 bg-blue-900/30 border border-blue-700 rounded-lg backdrop-blur-sm">
                  <h4 className="text-sm font-medium text-blue-300 mb-2">Current Routeset Mappings</h4>
                  <div className="text-sm text-blue-200">
                    <p><strong>Total Mappings:</strong> {mappings.length}</p>
                    <p><strong>Status:</strong> Ready for generation</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Action Button */}
            <div className="flex flex-col justify-center">
              <button
                onClick={handleGenerateDatabase}
                disabled={generating || activating || validating}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating Database...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Generate Routing Database
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-gray-700 border border-gray-600 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Process Steps</h4>
            <div className="text-sm text-gray-300 space-y-1">
              <p>1. <strong>Backup:</strong> Current routing data is backed up automatically</p>
              <p>2. <strong>Clear:</strong> Existing routing table is cleared</p>
              <p>3. <strong>Import:</strong> Routeset CSV files are processed and imported</p>
              <p>4. <strong>Validate:</strong> New routing data is validated for consistency</p>
              <p>5. <strong>Activate:</strong> New routing database becomes active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={loadData}
          disabled={loading || activating || validating || generating}
          className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-300 mr-2"></div>
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
    