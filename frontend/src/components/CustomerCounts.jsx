import React, { useState, useEffect } from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';

const CustomerCounts = ({ configId, user }) => {
  const { selectedInstance } = useProSBCInstance();
  const [liveCounts, setLiveCounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCounts = async () => {
    if (!configId || !selectedInstance) return;

    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('dashboard_token');
      const response = await fetch(`/backend/api/customer-counts?configId=${configId}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'X-ProSBC-Instance-ID': selectedInstance.id.toString()
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch counts: ${response.statusText}`);
      }

      const data = await response.json();
      setLiveCounts(data.liveCounts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [configId, selectedInstance]);

  const filterData = (data) => {
    if (!searchTerm) return data;
    return data.filter(item =>
      item.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredLiveCounts = filterData(liveCounts);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Customer Number Counts</h1>
        <p className="text-gray-400">Monitor dial map file counts per customer</p>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute right-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Live Counts */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Live Counts</h2>
          <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full">
            {selectedInstance?.id || 'Unknown'}
          </span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredLiveCounts.map((count, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                <span className="text-white font-medium truncate flex-1 mr-4">{count.customerName}</span>
                <span className="text-blue-400 font-bold text-lg bg-blue-900 px-3 py-1 rounded">
                  {count.count}
                </span>
              </div>
            ))}
            {filteredLiveCounts.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {searchTerm ? 'No customers match your search' : 'No data available'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-blue-400 mb-2">{filteredLiveCounts.length}</div>
          <div className="text-gray-400">Active Customers</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-green-400 mb-2">
            {filteredLiveCounts.reduce((sum, count) => sum + count.count, 0)}
          </div>
          <div className="text-gray-400">Total Live Numbers</div>
        </div>
      </div>

      <div className="mt-6 text-center">
        <button
          onClick={fetchCounts}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>
    </div>
  );
};

export default CustomerCounts;
