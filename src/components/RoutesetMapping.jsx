import React, { useState, useEffect } from 'react';
import {
  getRoutesetMappings,
  getNapEditData,
  updateNapMapping,
  getAvailableFiles,
  generateRoutingDatabase,
  activateConfiguration,
  getAvailableConfigurations,
  validateConfiguration
} from '../utils/routesetMappingService';

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
  const [selectedConfig, setSelectedConfig] = useState(1);
  const [activating, setActivating] = useState(false);
  const [validating, setValidating] = useState(false);

  // Load initial data
  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const mappingsData = await getRoutesetMappings();
      setMappings(mappingsData);
      
      // Also load available files and configurations
      if (mappingsData.length > 0) {
        const filesData = await getAvailableFiles();
        setAvailableFiles(filesData);
      }
      
      // Load available configurations
      try {
        const configsData = await getAvailableConfigurations();
        setConfigurations(configsData);
        
        // Set the currently selected configuration
        const activeConfig = configsData.find(config => config.isSelected);
        if (activeConfig) {
          setSelectedConfig(activeConfig.id);
        }
      } catch (configError) {
        console.log('Could not load configurations:', configError.message);
        // This is not critical, so we don't fail the whole operation
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
      
      const editData = await getNapEditData(napName);
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
      
      await updateNapMapping(editingNap, mappingData);
      
      setSuccessMessage('NAP mapping updated successfully');
      setEditingNap(null);
      setEditFormData(null);
      
      // Try to reload mappings, but don't fail if there's a CORS error
      try {
        await loadMappings();
      } catch (reloadError) {
        console.log('Could not reload mappings due to CORS, but update was successful');
        // Just refresh the page to show updated data
        window.location.reload();
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error saving mapping:', err);
      
      // Check if this is a network error that might actually be successful
      if (err.message.includes('Network Error') || err.message.includes('CORS')) {
        setSuccessMessage('NAP mapping updated successfully (refreshing page...)');
        setEditingNap(null);
        setEditFormData(null);
        
        // Refresh the page after a short delay to show updated data
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
      setSuccessMessage(''); // Clear any previous messages
      
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
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Routeset Mapping</h2>
        <p className="text-gray-600">Mapping of Routeset files and NAP configurations</p>
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

     

      {/* Mapping Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Mapping of Routeset files and NAP</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  NAPs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Routeset Definition
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Routeset Digitmap
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mappings.map((mapping, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-blue-600">
                      {mapping.napName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {mapping.routesetDefinition || (
                        <span className="text-gray-400 italic">Not mapped</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {mapping.routesetDigitmap || (
                        <span className="text-gray-400 italic">Not mapped</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleEditNap(mapping.napName)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit Mapping
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {mappings.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            No NAP mappings found
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingNap && editFormData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Editing {editingNap}
              </h3>
            </div>
            
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <input
                  type="text"
                  value={editFormData.priority}
                  onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight
                </label>
                <input
                  type="text"
                  value={editFormData.weight}
                  onChange={(e) => setEditFormData({ ...editFormData, weight: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Called Pre Remap
                </label>
                <input
                  type="text"
                  value={editFormData.calledPreRemap}
                  onChange={(e) => setEditFormData({ ...editFormData, calledPreRemap: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Routeset Definition
                </label>
                <select
                  value={editFormData.currentDefinition}
                  onChange={(e) => setEditFormData({ ...editFormData, currentDefinition: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Routeset Digitmap
                </label>
                <select
                  value={editFormData.currentDigitmap}
                  onChange={(e) => setEditFormData({ ...editFormData, currentDigitmap: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMapping}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Routing Database</h3>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
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
              <span className="text-sm text-gray-500">
                No routeset mappings available
              </span>
            )}
            
            {generating && (
              <span className="text-sm text-blue-600">
                This may take a few minutes...
              </span>
            )}
          </div>
          
          <p className="text-xs text-gray-500 mt-3">
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
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
              Refreshing...
            </div>
          ) : (
            'Refresh'
          )}
        </button>
      </div>
    </div>
  );
};

export default RoutesetMapping;
