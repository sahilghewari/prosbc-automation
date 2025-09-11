
import React, { useState, useEffect } from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext.jsx';

const RoutesetMapping = ({ onAuthError }) => {
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingNap, setEditingNap] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [availableFiles, setAvailableFiles] = useState({ definitions: [], digitmaps: [] });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Configuration management state
  const [configurations, setConfigurations] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState('');
  const [activating, setActivating] = useState(false);
  const [validating, setValidating] = useState(false);

  // ProSBC Instance Context
  const { 
    selectedInstanceId, 
    selectedInstance, 
    getInstanceHeaders, 
    registerRefreshCallback,
    hasSelectedInstance 
  } = useProSBCInstance();

  // Helper to get auth headers with instance support
  const getAuthHeaders = () => {
    const token = localStorage.getItem('dashboard_token');
    const baseHeaders = token ? { 'Authorization': 'Bearer ' + token } : {};
    
    // Add instance-specific headers if available
    return {
      ...baseHeaders,
      ...getInstanceHeaders()
    };
  };
  // Load initial data
  useEffect(() => {
    if (hasSelectedInstance) {
      loadMappings();
    }
  }, [hasSelectedInstance]);

  // Register for instance change callbacks
  useEffect(() => {
    const unregister = registerRefreshCallback((instanceId, instance) => {
      console.log(`[RoutesetMapping] Instance changed to: ${instanceId}`, instance);
      loadMappings();
    });

    return unregister;
  }, [registerRefreshCallback]);

  // Debug: log mappings whenever they change
  useEffect(() => {
    console.log('Mappings state changed:', mappings);
  }, [mappings]);

  const loadMappings = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!hasSelectedInstance) {
        console.log('[RoutesetMapping] No ProSBC instance selected, skipping load');
        setMappings([]);
        setLoading(false);
        return;
      }

      console.log(`[RoutesetMapping] Loading mappings for instance: ${selectedInstanceId}`);

      // Get mappings
      const mappingsRes = await fetch('/backend/api/routeset-mapping/mappings', { headers: getAuthHeaders() });
      if (!mappingsRes.ok) throw new Error(await mappingsRes.text());
      const mappingsJson = await mappingsRes.json();
      
      // If backend returns {success, mappings}, extract mappings
      const mappingsArr = Array.isArray(mappingsJson)
        ? mappingsJson
        : (Array.isArray(mappingsJson.mappings) ? mappingsJson.mappings : []);
      
      // Filter out mappings with missing or 'undefined' napName
      const filteredMappings = mappingsArr.filter(m => m.napName && m.napName !== 'undefined');
      console.log('Mappings from backend:', mappingsJson);
      console.log('Filtered mappings to display:', filteredMappings);
      setMappings(filteredMappings);

      // Get available files
      if (mappingsArr.length > 0) {
        const filesRes = await fetch('/backend/api/routeset-mapping/available-files', { headers: getAuthHeaders() });
        if (!filesRes.ok) throw new Error(await filesRes.text());
        const filesData = await filesRes.json();
        setAvailableFiles(filesData);
      }

      // Get available configurations
      try {
        const configsRes = await fetch('/backend/api/routeset-mapping/configurations', { headers: getAuthHeaders() });
        if (!configsRes.ok) throw new Error(await configsRes.text());
        const configsData = await configsRes.json();
        const configsArr = Array.isArray(configsData) ? configsData : [];
        setConfigurations(configsArr);
        // Set selectedConfig to the id of the selected config, or the first config's id, or ''
        let activeConfig = configsArr.find(config => config.isSelected);
        if (activeConfig) {
          setSelectedConfig(activeConfig.id);
        } else if (configsArr.length > 0) {
          setSelectedConfig(configsArr[0].id);
        } else {
          setSelectedConfig('');
        }
      } catch (configError) {
        console.log('Could not load configurations:', configError.message);
      }
    } catch (err) {
      console.error('Error loading mappings:', err);
      setError(err.message);
      if (err.message.includes('Authentication failed')) {
        onAuthError && onAuthError();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditNap = async (napName) => {
    try {
      setError(null);
      console.log('Editing NAP:', napName);

      const res = await fetch(`/backend/api/routeset-mapping/nap-edit-data/${encodeURIComponent(napName)}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(await res.text());
      const editData = await res.json();
      setEditFormData(editData.formData);
      setAvailableFiles(editData.availableFiles);
      setEditingNap(napName);
    } catch (err) {
      console.error('Error loading NAP edit data:', err);
      setError(err.message);
      if (err.message.includes('Authentication failed')) {
        onAuthError && onAuthError();
      }
    }
  };

  const handleSaveMapping = async () => {
    if (!editingNap || !editFormData) return;

    try {
      setSaving(true);
      setError(null);

      const mappingData = {
        priority: editFormData.priority,
        weight: editFormData.weight,
        calledPreRemap: editFormData.calledPreRemap,
        routesetDefinition: editFormData.currentDefinition,
        routesetDigitmap: editFormData.currentDigitmap
      };

      const res = await fetch(`/backend/api/routeset-mapping/update-nap-mapping/${encodeURIComponent(editingNap)}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(mappingData)
      });
      if (!res.ok) throw new Error(await res.text());

      setSuccessMessage('NAP mapping updated successfully');
      setEditingNap(null);
      setEditFormData(null);

      try {
        await loadMappings();
      } catch (reloadError) {
        console.log('Could not reload mappings due to CORS, but update was successful');
        window.location.reload();
      }

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving mapping:', err);
      if (err.message.includes('Network Error') || err.message.includes('CORS')) {
        setSuccessMessage('NAP mapping updated successfully (refreshing page...)');
        setEditingNap(null);
        setEditFormData(null);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(err.message);
        if (err.message.includes('Authentication failed')) {
          onAuthError && onAuthError();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateDatabase = async () => {
    const confirmed = window.confirm(
      'This will delete and recreate the routing table with the above routesets csv files. Are you sure?'
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
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error generating database:', err);
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
      if (err.message.includes('timeout')) {
        setTimeout(() => setError(null), 10000);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleActivateConfiguration = async () => {
    const configObj = configurations.find(c => c.id === selectedConfig);
    const confirmed = window.confirm(
      `Are you sure you want to activate configuration "${configObj ? configObj.name : selectedConfig}"? This will apply the configuration to the system.`
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
        try {
          const configsRes = await fetch('/backend/api/routeset-mapping/configurations', { headers: getAuthHeaders() });
          if (!configsRes.ok) throw new Error(await configsRes.text());
          const configsData = await configsRes.json();
          const configsArr = Array.isArray(configsData) ? configsData : [];
          setConfigurations(configsArr);
          // Update selectedConfig to match the new active config
          let activeConfig = configsArr.find(config => config.isSelected);
          if (activeConfig) {
            setSelectedConfig(activeConfig.id);
          } else if (configsArr.length > 0) {
            setSelectedConfig(configsArr[0].id);
          } else {
            setSelectedConfig('');
          }
        } catch (reloadError) {
          console.log('Could not reload configurations:', reloadError.message);
        }
      } else {
        throw new Error(result.message || 'Configuration activation failed');
      }
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

  const handleCancelEdit = () => {
    setEditingNap(null);
    setEditFormData(null);
    setError(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading routeset mappings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 border-b border-gray-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
                🗺️ Routeset Mapping 
                {selectedInstance && (
                  <span className="ml-3 px-3 py-1 text-sm bg-blue-600 text-white rounded-full">
                    {selectedInstance.name}
                  </span>
                )}
              </h2>
              <p className="text-gray-400 text-lg">
                Advanced mapping of Routeset files and NAP configurations
                {selectedInstance && (
                  <span className="text-gray-500">
                    {' '}for {selectedInstance.baseUrl}
                  </span>
                )}
              </p>
            </div>
            {!hasSelectedInstance && (
              <div className="text-center">
                <span className="inline-flex items-center px-4 py-2 text-sm text-yellow-400 bg-yellow-400/10 rounded-full border border-yellow-400/20">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  No ProSBC instance selected
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {!hasSelectedInstance ? (
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl backdrop-blur-sm">
            <div className="px-6 py-8 text-center">
              <div className="mx-auto w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No ProSBC Instance Selected</h3>
              <p className="text-gray-400 mb-6">
                Please select a ProSBC instance from the instance selector to view and manage routeset mappings.
              </p>
            </div>
          </div>
        ) : (
          <>
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-900/20 border border-green-700 rounded-xl p-4 backdrop-blur-sm">
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
          <div className="mb-6 bg-red-900/20 border border-red-700 rounded-xl p-4 backdrop-blur-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-red-300">{error}</span>
            </div>
          </div>
        )}

        {/* Mapping Table */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700 mb-6 overflow-hidden">
          <div className="px-6 py-6 border-b border-gray-600 bg-gradient-to-r from-gray-700/50 to-gray-800/50">
            <div className="flex items-center">
              <div className="bg-purple-600/20 p-3 rounded-lg mr-4">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Mapping Configuration</h3>
                <p className="text-gray-400 text-sm mt-1">Configure routeset file mappings and NAP associations</p>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>NAPs</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>Routeset Definition</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Routeset Digitmap</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                    <div className="flex items-center justify-center space-x-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                      <span>Actions</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800/30 divide-y divide-gray-700">
                {Array.isArray(mappings) && mappings.map((mapping, index) => (
                  <tr key={index} className="hover:bg-gray-700/50 transition-all duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                          <span className="text-white font-bold text-sm">{mapping.napName?.charAt(0) || 'N'}</span>
                        </div>
                        <div className="text-sm font-medium text-blue-400">
                          {mapping.napName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">
                        {mapping.routesetDefinition ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/50 text-green-400 border border-green-700">
                            {mapping.routesetDefinition}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700/50 text-gray-400 border border-gray-600">
                            Not mapped
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">
                        {mapping.routesetDigitmap ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-400 border border-yellow-700">
                            {mapping.routesetDigitmap}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700/50 text-gray-400 border border-gray-600">
                            Not mapped
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => handleEditNap(mapping.napName)}
                        className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border border-blue-600/30 hover:border-blue-500"
                      >
                        <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Mapping
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {Array.isArray(mappings) && mappings.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            No NAP mappings found
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingNap && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto backdrop-blur-sm">
            <div className="px-6 py-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">
                Editing {editingNap}
              </h3>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Priority
                </label>
                <input
                  type="text"
                  value={editFormData.priority}
                  onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Weight
                </label>
                <input
                  type="text"
                  value={editFormData.weight}
                  onChange={(e) => setEditFormData({ ...editFormData, weight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Called Pre Remap
                </label>
                <input
                  type="text"
                  value={editFormData.calledPreRemap}
                  onChange={(e) => setEditFormData({ ...editFormData, calledPreRemap: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Routeset Definition
                </label>
                <select
                  value={editFormData.currentDefinition}
                  onChange={(e) => setEditFormData({ ...editFormData, currentDefinition: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a definition file...</option>
                  {availableFiles.definitions.map((file) => (
                    <option key={file.value} value={file.value}>
                      {file.text}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Routeset Digitmap
                </label>
                <select
                  value={editFormData.currentDigitmap}
                  onChange={(e) => setEditFormData({ ...editFormData, currentDigitmap: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a digitmap file...</option>
                  {availableFiles.digitmaps.map((file) => (
                    <option key={file.value} value={file.value}>
                      {file.text}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-600 flex justify-end space-x-3">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 border border-transparent rounded-md hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {saving ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </div>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Routing Database Section */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Routing Database</h3>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-sm text-gray-300 mb-4">
            Generate routing database from the mapped routeset files above.
          </p>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={handleGenerateDatabase}
              disabled={generating || mappings.length === 0}
              className={`px-6 py-2 text-sm font-medium text-white border border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                generating 
                  ? 'bg-red-400' 
                  : mappings.length === 0 
                    ? 'bg-gray-400' 
                    : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {generating ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Generating Database...
                </div>
              ) : (
                'Generate Routing Database'
              )}
            </button>
            
            {mappings.length === 0 && (
              <span className="text-sm text-gray-400">
                No routeset mappings available
              </span>
            )}
            
            {generating && (
              <span className="text-sm text-blue-400">
                This may take a few minutes...
              </span>
            )}
          </div>
          
          <p className="text-xs text-gray-400 mt-3">
            <strong>Warning:</strong> This will delete and recreate the routing table with the above routesets CSV files.
            {mappings.length > 0 && (
              <span className="block mt-1">
                Currently mapped files: {mappings.filter(m => m.routesetDefinition && m.routesetDigitmap).length} of {mappings.length} NAPs
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={loadMappings}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-200"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-300 mr-2"></div>
              Refreshing...
            </div>
          ) : (
            'Refresh'
          )}
        </button>
      </div>
          </>
        )}
      </div>
    </div>
  );
};


export default RoutesetMapping;
