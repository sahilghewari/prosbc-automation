import React, { useState, useEffect } from 'react';
import { fetchLiveNaps, deleteNap, updateNap } from '../utils/napApiClientFixed';
import './NapManager.css';
import EditNapModal from './NapEditor';
import NetworkTest from './NetworkTest';


const NapManager = ({ onAuthError }) => {
  const [naps, setNaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterTerm, setFilterTerm] = useState('');
  const [selectedNap, setSelectedNap] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedNapId, setSelectedNapId] = useState(null);

  const config = {
    baseUrl: '/api', // This should match your proxy configuration
    sessionCookie: null // Since you're using proxy, session might be handled differently
  };


  useEffect(() => {
    loadNaps();
  }, []);

  const loadNaps = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const napData = await fetchLiveNaps();
      setNaps(napData);
    } catch (err) {
      const errorMessage = err.message || 'Unknown error occurred';
      setError(`Failed to load NAPs: ${errorMessage}`);
      console.error('Error loading NAPs:', err);
      
      // Check for authentication errors and redirect to login
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

  const handleDelete = async (napId, napName) => {
    if (!window.confirm(`Are you sure you want to delete '${napName}'?`)) {
      return;
    }

    try {
      setLoading(true);
      await deleteNap(napId);
      // Refresh the list after successful deletion
      await loadNaps();
      alert(`NAP '${napName}' was successfully deleted.`);
    } catch (err) {
      setError(`Failed to delete NAP: ${err.message}`);
      console.error('Error deleting NAP:', err);
      
      // Check for authentication errors and redirect to login
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

  const handleEditNap = (napId) => {
    setSelectedNapId(napId);
    setEditModalOpen(true);
  };

   const handleEditSuccess = () => {
    // Refresh the NAP list
    loadNaps();
    setEditModalOpen(false);
    setSelectedNapId(null);
  };
  const handleEdit = (nap) => {
    // Show a message about edit limitations for now
    alert(`Edit functionality is currently limited. 

To edit NAP '${nap.name}', please:
1. Use the ProSBC web interface directly
2. Navigate to ${window.location.origin}/api/naps/${nap.id}/edit

Note: Full edit functionality via this interface requires additional development to parse and handle the complex form structure.`);
    
    // Uncomment the following lines when edit functionality is fully implemented:
    /*
    setSelectedNap(nap);
    setEditData({
      name: nap.name,
      sipProxy: nap.sipProxy,
      localIp: nap.localIp,
      protocol: nap.protocol,
      enabled: !nap.disabled
    });
    setShowEditModal(true);
    */
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      await updateNap(selectedNap.id, editData);
      setShowEditModal(false);
      setSelectedNap(null);
      // Refresh the list after successful update
      await loadNaps();
      alert(`NAP '${editData.name}' was successfully updated.`);
    } catch (err) {
      setError(`Failed to update NAP: ${err.message}`);
      console.error('Error updating NAP:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredNaps = naps.filter(nap =>
    nap.name.toLowerCase().includes(filterTerm.toLowerCase()) ||
    nap.sipProxy.toLowerCase().includes(filterTerm.toLowerCase()) ||
    nap.localIp.toLowerCase().includes(filterTerm.toLowerCase())
  );

  if (loading && naps.length === 0) {
    return (
      <div className="nap-manager">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading NAPs from ProSBC...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="nap-manager">
      <div className="nap-manager-header">
        <h1>NAP Management</h1>
        <p className="subtitle">
          View, modify, and delete Network Access Points from ProSBC
        </p>
      </div>

      {error && (
        <div className="error-banner">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="error-close">×</button>
          </div>
        </div>
      )}

      <div className="controls-section">
        <div className="filter-container">
          <input
            type="text"
            placeholder="Filter NAPs by name, SIP proxy, or local IP..."
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            className="filter-input"
          />
          <span className="filter-icon">🔍</span>
        </div>
        
        <button onClick={loadNaps} className="refresh-btn" disabled={loading}>
          {loading ? '↻' : '🔄'} Refresh
        </button>
      </div>

      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {naps.map((nap, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {nap.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      nap.enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {nap.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => handleEditNap(nap.id)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(nap.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <EditNapModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        napId={selectedNapId}
        baseUrl={config.baseUrl}
        sessionCookie={config.sessionCookie}
        onSuccess={handleEditSuccess}
      />

      {/* Temporary debug component */}
      <NetworkTest baseUrl={config.baseUrl} sessionCookie={config.sessionCookie} />

      <div className="naps-summary">
        <p>
          Showing {filteredNaps.length} of {naps.length} NAPs
          {filterTerm && ` (filtered by "${filterTerm}")`}
        </p>
      </div>
    </div>
  );
};

export default NapManager;
