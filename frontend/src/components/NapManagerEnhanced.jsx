import React, { useState, useEffect } from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';
import { useInstanceRefresh } from '../hooks/useInstanceRefresh';
// import { fetchLiveNaps, deleteNap, updateNap } from '../utils/napApiClientFixed';

// Helper functions to call backend RESTful API endpoints with configId
const getAuthHeaders = () => {
  const token = localStorage.getItem('dashboard_token');
  return token
    ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

// All NAP operations now require configId and napName (not napId)
const fetchLiveNaps = async (configId, selectedInstanceId) => {
  // Use instance-specific API endpoint
  const token = localStorage.getItem('dashboard_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
  
  // Construct instance-specific URL
  const url = selectedInstanceId 
    ? `/backend/api/prosbc-nap-api/instances/${selectedInstanceId}/configurations/${configId}/naps`
    : `/backend/api/prosbc-nap-api/configurations/${configId}/naps`;
  
  console.log(`[fetchLiveNaps] Using URL: ${url} for instance: ${selectedInstanceId}`);
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API call failed: ${response.status}`);
  }
  
  const data = await response.json();
  if (!data.success) throw new Error(data.message || 'Failed to fetch NAPs');
  // Always return an array for naps
  if (Array.isArray(data.naps)) return data.naps;
  if (data.naps && typeof data.naps === 'object') {
    // Convert object to array, skip meta keys
    return Object.keys(data.naps)
      .filter(key => key !== '***meta***')
      .map(key => ({ name: key, ...data.naps[key] }));
  }
  return [];
};

const deleteNap = async (configId, napName, selectedInstanceId) => {
  // Use instance-specific API endpoint
  const token = localStorage.getItem('dashboard_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
  
  // Construct instance-specific URL
  const url = selectedInstanceId 
    ? `/backend/api/prosbc-nap-api/instances/${selectedInstanceId}/configurations/${configId}/naps/${encodeURIComponent(napName)}`
    : `/backend/api/prosbc-nap-api/configurations/${configId}/naps/${encodeURIComponent(napName)}`;
  
  console.log(`[deleteNap] Using URL: ${url} for instance: ${selectedInstanceId}`);
  
  const response = await fetch(url, {
    method: 'DELETE',
    headers
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API call failed: ${response.status}`);
  }
  
  const data = await response.json();
  if (!data.success) throw new Error(data.message || 'Failed to delete NAP');
  return data;
};

const updateNap = async (configId, napName, napData, selectedInstanceId) => {
  // Use instance-specific API endpoint
  const token = localStorage.getItem('dashboard_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
  
  // Construct instance-specific URL
  const url = selectedInstanceId 
    ? `/backend/api/prosbc-nap-api/instances/${selectedInstanceId}/configurations/${configId}/naps/${encodeURIComponent(napName)}`
    : `/backend/api/prosbc-nap-api/configurations/${configId}/naps/${encodeURIComponent(napName)}`;
  
  console.log(`[updateNap] Using URL: ${url} for instance: ${selectedInstanceId}`);
  
  const response = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(napData)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API call failed: ${response.status}`);
  }
  
  const data = await response.json();
  if (!data.success) throw new Error(data.message || 'Failed to update NAP');
  return data;
};
import EditNapModal from './NapEditor';


// Accept configId as a prop (default to 'config_1' if not provided)
const NapManagerEnhanced = ({ onAuthError, configId = 'config_1' }) => {
  const { selectedInstance, hasSelectedInstance, selectedInstanceId } = useProSBCInstance();

  const [naps, setNaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterTerm, setFilterTerm] = useState('');
  const [selectedNap, setSelectedNap] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedNapName, setSelectedNapName] = useState(null);
  const [baseUrl, setBaseUrl] = useState('/api');
  const [sessionCookie, setSessionCookie] = useState('');

  // Define loadNaps function for reuse
  const loadNaps = async (instance = null) => {
    const targetInstance = instance || selectedInstance;
    const targetInstanceId = targetInstance?.id || selectedInstanceId;
    
    if (!targetInstance && !hasSelectedInstance) return;
    
    try {
      setLoading(true);
      setError(null);
      console.log('[NapManagerEnhanced] Loading NAPs for instance:', targetInstanceId);
      const napData = await fetchLiveNaps(configId, targetInstanceId);
      setNaps(napData);
    } catch (err) {
      const errorMessage = err.message || 'Unknown error occurred';
      setError(`Failed to load NAPs: ${errorMessage}`);
      console.error('Error loading NAPs:', err);
      if (errorMessage.includes('login') || 
          errorMessage.includes('auth') || 
          errorMessage.includes('session expired')) {
        if (onAuthError) {
          onAuthError();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Add instance refresh hook to automatically reload NAPs when instance changes
  useInstanceRefresh(
    async (instance) => {
      console.log('[NapManagerEnhanced] Refreshing NAPs for instance:', instance?.id);
      await loadNaps(instance);
    },
    [configId], // Dependencies - reload when configId changes too
    {
      refreshOnMount: true,
      refreshOnInstanceChange: true
    }
  );

  // Instance check
  if (!hasSelectedInstance) {
    return (
      <div className="bg-gray-800 border border-yellow-600 rounded-lg p-6 text-center">
        <div className="text-yellow-400 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No ProSBC Instance Selected</h3>
        <p className="text-gray-300 mb-4">Please select a ProSBC instance to manage NAPs.</p>
        <p className="text-sm text-gray-400">Use the instance selector at the top of the page to choose a ProSBC server.</p>
      </div>
    );
  }

  useEffect(() => {
    if (hasSelectedInstance) {
      // Get session cookie from document.cookie
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      if (cookies['_prosbc_session']) {
        setSessionCookie(cookies['_prosbc_session']);
      }
      loadNaps();
    }
    // Re-load naps when configId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId, hasSelectedInstance]);

  const handleDelete = async (napName) => {
    if (!window.confirm(`Are you sure you want to delete '${napName}'?`)) {
      return;
    }
    try {
      setLoading(true);
      await deleteNap(configId, napName, selectedInstanceId);
      await loadNaps();
      alert(`NAP '${napName}' was successfully deleted.`);
    } catch (err) {
      setError(`Failed to delete NAP: ${err.message}`);
      console.error('Error deleting NAP:', err);
      const errorMessage = err.message || '';
      if (errorMessage.includes('login') || 
          errorMessage.includes('auth') || 
          errorMessage.includes('session expired')) {
        if (onAuthError) {
          onAuthError();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditNap = (napName) => {
    setSelectedNapName(napName);
    setEditModalOpen(true);
    if (!baseUrl) {
      setBaseUrl('/api');
    }
    if (!sessionCookie) {
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      if (cookies['_prosbc_session']) {
        setSessionCookie(cookies['_prosbc_session']);
      }
    }
  };

  const handleEditSuccess = () => {
    loadNaps();
    setEditModalOpen(false);
    setSelectedNapName(null);
  };

  const filteredNaps = naps.filter(nap => 
    nap.name?.toLowerCase().includes(filterTerm.toLowerCase()) ||
    nap.sip_destination_ip?.toLowerCase().includes(filterTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 border-b border-gray-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                NAP Management Center
              </h1>
              <p className="text-gray-400 mt-2 text-lg">Monitor and manage your Network Access Points</p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-gray-700/50 px-4 py-2 rounded-lg border border-gray-600">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm text-gray-300">Live Data</span>
                </div>
              </div>
              <button
                onClick={loadNaps}
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-6 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <svg className={`w-5 h-5 inline mr-2 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Search & Filter</h2>
              <span className="text-sm text-gray-400">
                {filteredNaps.length} of {naps.length} NAPs
              </span>
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search NAPs by name, ID, or destination IP..."
                value={filterTerm}
                onChange={(e) => setFilterTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-16">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
                <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Loading NAPs...</h3>
              <p className="text-gray-400">Fetching latest data from ProSBC</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-700 rounded-xl p-6 mb-8">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-red-400">Error Loading NAPs</h3>
                <p className="text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* NAP Table */}
        {!loading && !error && (
          <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50 border-b border-gray-600">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300 uppercase tracking-wider">NAP Details</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {filteredNaps.length === 0 ? (
                    <tr>
                      <td colSpan="2" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <svg className="w-16 h-16 text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <h3 className="text-lg font-medium text-gray-400 mb-2">No NAPs Found</h3>
                          <p className="text-gray-500">
                            {filterTerm ? 'Try adjusting your search criteria' : 'No NAPs have been created yet'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredNaps.map((nap, index) => (
                      <tr key={nap.name} className="hover:bg-gray-700/30 transition-all duration-200">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-sm">{nap.name?.charAt(0) || 'N'}</span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-white">{nap.name || 'Unnamed NAP'}</div>
                              <div className="text-sm text-gray-400">Name: {nap.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleEditNap(nap.name)}
                              className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border border-blue-600/30 hover:border-blue-500"
                            >
                              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(nap.name)}
                              className="bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 border border-red-600/30 hover:border-red-500"
                            >
                              <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {!loading && !error && naps.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/50 border border-blue-700/50 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center">
                <div className="bg-blue-600/20 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-blue-300">Total NAPs</p>
                  <p className="text-2xl font-bold text-white">{naps.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/50 border border-purple-700/50 rounded-xl p-6 backdrop-blur-sm">
              <div className="flex items-center">
                <div className="bg-purple-600/20 p-3 rounded-lg">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-purple-300">Search Results</p>
                  <p className="text-2xl font-bold text-white">{filteredNaps.length}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        
      </div>

      {/* Modal Components */}
      {editModalOpen && selectedNapName && (
        <EditNapModal
          isOpen={editModalOpen}
          napName={selectedNapName}
          configId={configId}
          baseUrl={baseUrl}
          sessionCookie={sessionCookie}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedNapName(null);
          }}
          onSuccess={handleEditSuccess}
          onAuthError={onAuthError}
        />
      )}
    </div>
  );
};

export default NapManagerEnhanced;
