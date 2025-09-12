import React, { useState, useEffect } from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';

const CustomerCounts = ({ configId }) => {
  const { selectedInstance, instances } = useProSBCInstance();
  const [liveCounts, setLiveCounts] = useState([]);
  const [historicalCounts, setHistoricalCounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHistoricalInstance, setSelectedHistoricalInstance] = useState(selectedInstance?.id || '');

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
      setHistoricalCounts(data.historicalCounts || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistoricalForInstance = async (instanceId) => {
    if (!configId || !instanceId) return;

    try {
      const token = localStorage.getItem('dashboard_token');
      const response = await fetch(`/backend/api/customer-counts/historical?instanceId=${instanceId}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch historical counts: ${response.statusText}`);
      }

      const data = await response.json();
      setHistoricalCounts(data.historicalCounts || []);
    } catch (err) {
      console.error('Failed to fetch historical data:', err);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [configId, selectedInstance]);

  useEffect(() => {
    if (selectedHistoricalInstance && selectedHistoricalInstance !== selectedInstance?.id) {
      fetchHistoricalForInstance(selectedHistoricalInstance);
    } else {
      // If viewing current instance, use the data from fetchCounts
      fetchCounts();
    }
  }, [selectedHistoricalInstance]);

  const filterData = (data) => {
    if (!searchTerm) return data;
    return data.filter(item =>
      item.customerName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredLiveCounts = filterData(liveCounts);
  const filteredHistoricalCounts = filterData(historicalCounts);

  const groupHistoricalByDate = (counts) => {
    const grouped = {};
    counts.forEach(count => {
      if (!grouped[count.date]) {
        grouped[count.date] = [];
      }
      grouped[count.date].push(count);
    });
    return grouped;
  };

  const historicalGrouped = groupHistoricalByDate(filteredHistoricalCounts);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Customer DM Counts</h1>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
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

        {/* Historical Counts */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Historical Counts</h2>
            <select
              value={selectedHistoricalInstance}
              onChange={(e) => setSelectedHistoricalInstance(e.target.value)}
              className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {instances.map(instance => (
                <option key={instance.id} value={instance.id}>
                  {instance.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.keys(historicalGrouped).sort().reverse().map(date => (
              <div key={date} className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3 pb-2 border-b border-gray-600">{date}</h3>
                <div className="space-y-2">
                  {historicalGrouped[date].map((count, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-600 rounded hover:bg-gray-500 transition-colors">
                      <span className="text-gray-300 truncate flex-1 mr-4">{count.customerName}</span>
                      <span className="text-green-400 font-bold bg-green-900 px-2 py-1 rounded text-sm">
                        {count.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(historicalGrouped).length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {searchTerm ? 'No historical data matches your search' : 'No historical data available'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <div className="bg-gray-800 rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-purple-400 mb-2">
            {Object.keys(historicalGrouped).length}
          </div>
          <div className="text-gray-400">Historical Months</div>
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
