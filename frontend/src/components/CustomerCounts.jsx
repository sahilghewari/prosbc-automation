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
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState(null);
  const [numberSearch, setNumberSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [debugging, setDebugging] = useState(false);
  const [debugResult, setDebugResult] = useState(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [recordingCounts, setRecordingCounts] = useState(false);
  const [recordResult, setRecordResult] = useState(null);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [runInBackground, setRunInBackground] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

    setLoadingHistorical(true);
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
      setHistoricalCounts([]);
    } finally {
      setLoadingHistorical(false);
    }
  };

  const searchNumber = async () => {
    if (!numberSearch.trim()) return;

    setSearching(true);
    setSearchResult(null);
    try {
      const token = localStorage.getItem('dashboard_token');
      const response = await fetch(`/backend/api/dm-files/search?numbers=${encodeURIComponent(numberSearch)}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const data = await response.json();
      setSearchResult(data);
    } catch (err) {
      setSearchResult({ success: false, error: err.message });
    } finally {
      setSearching(false);
    }
  };

  const syncDMFiles = async () => {
    if (!configId || !selectedInstance) return;

    setSyncing(true);
    setSyncResult(null);
    try {
      const token = localStorage.getItem('dashboard_token');
      const response = await fetch('/backend/api/dm-files/sync', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'X-ProSBC-Instance-ID': selectedInstance.id.toString(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ configId })
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      const data = await response.json();
      setSyncResult(data);
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setSyncing(false);
    }
  };

  const replaceDMFiles = async () => {
    if (!configId || instances.length === 0) return;

    setIsProcessing(true);
    if (!runInBackground) setSyncing(true);
    setSyncResult(null);
    setSyncProgress({ current: 0, total: instances.length });
    const results = { successes: [], failures: [] };

    try {
      const token = localStorage.getItem('dashboard_token');

      // Process all instances in parallel
      const processInstance = async (instance) => {
        try {
          // Clear existing data for this instance
          const clearResponse = await fetch('/backend/api/dm-files/clear', {
            method: 'DELETE',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'X-ProSBC-Instance-ID': instance.id.toString()
            }
          });

          if (!clearResponse.ok) {
            throw new Error(`Clear failed for instance ${instance.id}: ${clearResponse.statusText}`);
          }

          // Sync new data for this instance
          const syncResponse = await fetch('/backend/api/dm-files/sync', {
            method: 'POST',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'X-ProSBC-Instance-ID': instance.id.toString(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ configId })
          });

          if (!syncResponse.ok) {
            throw new Error(`Sync failed for instance ${instance.id}: ${syncResponse.statusText}`);
          }

          const data = await syncResponse.json();
          return { success: true, instanceId: instance.id, ...data };
        } catch (err) {
          return { success: false, instanceId: instance.id, error: err.message };
        }
      };

      const promises = instances.map(processInstance);
      const settledResults = await Promise.allSettled(promises);

      // Process results
      settledResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const data = result.value;
          if (data.success) {
            results.successes.push(data);
          } else {
            results.failures.push(data);
          }
        } else {
          // This shouldn't happen with our error handling, but just in case
          results.failures.push({ instanceId: 'unknown', error: result.reason });
        }
        setSyncProgress(prev => ({ ...prev, current: prev.current + 1 }));
      });

      // Aggregate final result
      const hasSuccesses = results.successes.length > 0;
      const hasFailures = results.failures.length > 0;
      setSyncResult({
        success: hasSuccesses && !hasFailures, // Fully successful only if no failures
        message: hasSuccesses
          ? `Data replaced successfully for ${results.successes.length} instance(s). ${hasFailures ? `${results.failures.length} instance(s) failed.` : ''}`
          : 'All replacements failed.',
        successes: results.successes,
        failures: results.failures
      });
    } catch (err) {
      setSyncResult({ success: false, error: err.message });
    } finally {
      setIsProcessing(false);
      if (!runInBackground) setSyncing(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  const cleanupDMFiles = async () => {
    if (!selectedInstance) return;

    setCleaning(true);
    setCleanupResult(null);
    try {
      const token = localStorage.getItem('dashboard_token');
      const response = await fetch('/backend/api/dm-files/cleanup', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'X-ProSBC-Instance-ID': selectedInstance.id.toString()
        }
      });

      if (!response.ok) {
        throw new Error(`Cleanup failed: ${response.statusText}`);
      }

      const data = await response.json();
      setCleanupResult(data);
    } catch (err) {
      setCleanupResult({ success: false, error: err.message });
    } finally {
      setCleaning(false);
    }
  };

  const debugDMFiles = async () => {
    if (!selectedInstance) return;

    setDebugging(true);
    setDebugResult(null);
    try {
      const token = localStorage.getItem('dashboard_token');
      const response = await fetch(`/backend/api/dm-files/debug?instanceId=${selectedInstance.id}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });

      if (!response.ok) {
        throw new Error(`Debug failed: ${response.statusText}`);
      }

      const data = await response.json();
      setDebugResult(data);
    } catch (err) {
      setDebugResult({ success: false, error: err.message });
    } finally {
      setDebugging(false);
    }
  };

  const recordCounts = async () => {
    if (!configId || !selectedInstance) return;

    setRecordingCounts(true);
    setRecordResult(null);
    try {
      const token = localStorage.getItem('dashboard_token');
      const response = await fetch('/backend/api/customer-counts/create-monthly', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'X-ProSBC-Instance-ID': selectedInstance.id.toString(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ configId })
      });

      if (!response.ok) {
        throw new Error(`Failed to record counts: ${response.statusText}`);
      }

      const data = await response.json();
      setRecordResult(data);
      // Refresh the counts to show the new historical data
      fetchCounts();
    } catch (err) {
      setRecordResult({ success: false, error: err.message });
    } finally {
      setRecordingCounts(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [configId, selectedInstance]);

  useEffect(() => {
    // Update selectedHistoricalInstance when selectedInstance changes
    if (selectedInstance?.id && selectedInstance.id !== selectedHistoricalInstance) {
      setSelectedHistoricalInstance(selectedInstance.id);
    }
  }, [selectedInstance]);

  useEffect(() => {
    if (selectedHistoricalInstance && selectedHistoricalInstance !== selectedInstance?.id) {
      fetchHistoricalForInstance(selectedHistoricalInstance);
      setSelectedHistoricalDate(null); // Reset selected date when instance changes
    } else {
      // If viewing current instance, use the data from fetchCounts
      fetchCounts();
      setSelectedHistoricalDate(null); // Reset selected date when switching back to current instance
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
        <h1 className="text-3xl font-bold text-white mb-2">Customer Number Counts</h1>
        <p className="text-gray-400">Monitor dial map file counts per customer</p>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Number Search */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">Database Number Search</h2>
        <div className="flex gap-4">
          <div className="flex-1">
            <textarea
              placeholder="Enter phone numbers separated by commas (e.g., 1234567890, 0987654321, 5551234567)"
              value={numberSearch}
              onChange={(e) => setNumberSearch(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
          <button
            onClick={searchNumber}
            disabled={searching || !numberSearch.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors h-fit"
          >
            {searching ? 'Searching...' : 'Search Database'}
          </button>
        </div>
        <p className="text-gray-400 text-sm mt-2">
          Search for phone numbers in the stored DM files database. Shows which file and ProSBC instance each number belongs to.
        </p>
        {searchResult && (
          <div className="mt-4">
            {searchResult.success && searchResult.results ? (
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-white font-semibold">Number</th>
                      <th className="px-4 py-3 text-left text-white font-semibold">Status</th>
                      <th className="px-4 py-3 text-left text-white font-semibold">Found In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResult.results.map((result, index) => (
                      <tr key={index} className="border-t border-gray-600">
                        <td className="px-4 py-3 text-white font-mono">{result.number}</td>
                        <td className="px-4 py-3">
                          {result.found ? (
                            <span className="text-green-400 font-semibold">Found</span>
                          ) : (
                            <span className="text-red-400 font-semibold">Not Found</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-300">
                          {result.found && result.locations ? (
                            <div className="space-y-1">
                              {result.locations.map((location, locIndex) => (
                                <div key={locIndex} className="text-sm">
                                  <span className="font-medium text-blue-400">{location.file_name}</span>
                                  <span className="text-gray-400"> in </span>
                                  <span className="font-medium text-purple-400">{location.prosbc_instance_name}</span>
                                  <span className="text-gray-500"> ({location.prosbc_instance_id})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            'N/A'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-gray-800 rounded-lg">
                <div className="text-red-400">
                  {searchResult.error || 'Search failed'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DM Files Sync */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">DM Files Management</h2>
        <div className="mb-4">
          <label className="flex items-center text-gray-300">
            <input
              type="checkbox"
              checked={runInBackground}
              onChange={(e) => setRunInBackground(e.target.checked)}
              className="mr-2"
            />
            Run in background (allows other operations while processing)
          </label>
        </div>
        <div className="flex gap-4 items-center mb-4">
          <button
            onClick={syncDMFiles}
            disabled={syncing || !configId || !selectedInstance}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {syncing ? 'Syncing...' : 'Sync DM Files'}
          </button>
          <button
            onClick={replaceDMFiles}
            disabled={(!runInBackground && syncing) || !configId || instances.length === 0}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {(!runInBackground && syncing) ? 'Replacing...' : 'Replace All Data'}
          </button>
          <button
            onClick={cleanupDMFiles}
            disabled={cleaning || !selectedInstance}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {cleaning ? 'Cleaning...' : 'Cleanup Data'}
          </button>
          <button
            onClick={debugDMFiles}
            disabled={debugging || !selectedInstance}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {debugging ? 'Debugging...' : 'Debug Data'}
          </button>
          <button
            onClick={recordCounts}
            disabled={recordingCounts || !configId || !selectedInstance}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            {recordingCounts ? 'Recording...' : 'Record Number Counts'}
          </button>
        </div>
        {isProcessing && syncProgress.total > 0 && (
          <div className="mb-4">
            <div className="text-sm text-gray-300 mb-2">
              Processing instances: {syncProgress.current} / {syncProgress.total}
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-red-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        )}
        <p className="text-gray-400 text-sm mb-4">
          Sync adds new files. Replace clears all existing data and syncs fresh data. Cleanup fixes malformed JSON data. Debug shows data format and validation results. Record Number Counts creates monthly historical records for current customer counts.
        </p>
        {syncResult && (
          <div className="mt-4">
            {syncResult.success ? (
              <div className="p-4 bg-green-900 border border-green-700 text-green-100 rounded-lg">
                <div className="font-semibold mb-2">Replacement completed!</div>
                <div className="text-sm">
                  {syncResult.message}
                  {syncResult.successes && syncResult.successes.length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium">Successful Instances:</div>
                      <ul className="list-disc list-inside mt-1">
                        {syncResult.successes.map((success, index) => (
                          <li key={index}>Instance {success.instanceId}: {success.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {syncResult.failures && syncResult.failures.length > 0 && (
                    <div className="mt-2">
                      <div className="font-medium text-red-300">Failed Instances:</div>
                      <ul className="list-disc list-inside mt-1">
                        {syncResult.failures.map((failure, index) => (
                          <li key={index} className="text-red-300">Instance {failure.instanceId}: {failure.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-900 border border-red-700 text-red-100 rounded-lg">
                <div className="font-semibold">Replacement failed</div>
                <div className="text-sm mt-1">{syncResult.error}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {cleanupResult && (
        <div className="mb-6">
          {cleanupResult.success ? (
            <div className="p-4 bg-yellow-900 border border-yellow-700 text-yellow-100 rounded-lg">
              <div className="font-semibold mb-2">Cleanup completed!</div>
              <div className="text-sm">
                {cleanupResult.message}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-900 border border-red-700 text-red-100 rounded-lg">
              <div className="font-semibold">Cleanup failed</div>
              <div className="text-sm mt-1">{cleanupResult.error}</div>
            </div>
          )}
        </div>
      )}

      {debugResult && (
        <div className="mb-6">
          {debugResult.success ? (
            <div className="p-4 bg-purple-900 border border-purple-700 text-purple-100 rounded-lg">
              <div className="font-semibold mb-2">Debug Results:</div>
              <div className="text-sm">
                <div className="mb-2">Total records: {debugResult.totalRecords}</div>
                <div className="mb-2">Valid JSON records: {debugResult.validRecords}</div>
                <div className="mb-2">Invalid JSON records: {debugResult.invalidRecords}</div>
                {debugResult.sampleData && debugResult.sampleData.length > 0 && (
                  <div className="mt-4">
                    <div className="font-medium mb-2">Sample Data:</div>
                    <pre className="bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                      {JSON.stringify(debugResult.sampleData, null, 2)}
                    </pre>
                  </div>
                )}
                {debugResult.errors && debugResult.errors.length > 0 && (
                  <div className="mt-4">
                    <div className="font-medium mb-2">Errors:</div>
                    <ul className="list-disc list-inside">
                      {debugResult.errors.map((error, index) => (
                        <li key={index} className="text-red-300">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-900 border border-red-700 text-red-100 rounded-lg">
              <div className="font-semibold">Debug failed</div>
              <div className="text-sm mt-1">{debugResult.error}</div>
            </div>
          )}
        </div>
      )}

      {recordResult && (
        <div className="mb-6">
          {recordResult.success ? (
            <div className="p-4 bg-green-900 border border-green-700 text-green-100 rounded-lg">
              <div className="font-semibold mb-2">Number counts recorded successfully!</div>
              <div className="text-sm">
                {recordResult.message}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-red-900 border border-red-700 text-red-100 rounded-lg">
              <div className="font-semibold">Failed to record counts</div>
              <div className="text-sm mt-1">{recordResult.error}</div>
            </div>
          )}
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
            <h2 className="text-xl font-semibold text-white">
              {selectedHistoricalDate ? `Historical Counts - ${selectedHistoricalDate}` : 'Historical Counts'}
            </h2>
            <div className="flex items-center space-x-3">
              <label className="text-gray-300 text-sm">Instance:</label>
              <select
                value={selectedHistoricalInstance}
                onChange={(e) => setSelectedHistoricalInstance(e.target.value)}
                className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {instances.map(instance => (
                  <option key={instance.id} value={instance.id}>
                    ProSBC {instance.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {loadingHistorical ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                <p className="text-gray-400 mt-2">Loading historical data...</p>
              </div>
            ) : !selectedHistoricalDate ? (
              // Show date list
              <div className="space-y-3">
                <h3 className="text-white font-medium mb-4">Select a Date to View Historical Counts</h3>
                {Object.keys(historicalGrouped).sort().reverse().map(date => (
                  <div
                    key={date}
                    onClick={() => setSelectedHistoricalDate(date)}
                    className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition-colors border border-gray-600 hover:border-gray-500"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-white font-medium text-lg">{date}</div>
                        <div className="text-gray-300 text-sm">
                          {historicalGrouped[date].length} customers
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-green-400 font-bold bg-green-900 px-3 py-1 rounded text-sm">
                          {historicalGrouped[date].reduce((sum, count) => sum + count.count, 0).toLocaleString()} total numbers
                        </span>
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
                {Object.keys(historicalGrouped).length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    {searchTerm ? 'No historical data matches your search' : 'No historical data available for this instance'}
                  </div>
                )}
              </div>
            ) : (
              // Show selected date details
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={() => setSelectedHistoricalDate(null)}
                    className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Date Selection
                  </button>
                  <h3 className="text-white font-medium">{selectedHistoricalDate}</h3>
                </div>
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {historicalGrouped[selectedHistoricalDate]
                      .sort((a, b) => b.count - a.count) // Sort by count descending
                      .map((count, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-600 rounded hover:bg-gray-500 transition-colors">
                        <span className="text-gray-300 truncate flex-1 mr-4 text-sm font-medium">{count.customerName}</span>
                        <span className="text-green-400 font-bold bg-green-900 px-2 py-1 rounded text-sm">
                          {count.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-600">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Total Customers: {historicalGrouped[selectedHistoricalDate].length}</span>
                      <span className="text-green-400 font-bold">
                        Total Numbers: {historicalGrouped[selectedHistoricalDate].reduce((sum, count) => sum + count.count, 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
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
            {selectedHistoricalDate && historicalGrouped[selectedHistoricalDate] 
              ? historicalGrouped[selectedHistoricalDate].reduce((sum, count) => sum + count.count, 0)
              : Object.keys(historicalGrouped).length > 0 
                ? Object.values(historicalGrouped).reduce((total, dateData) => 
                    total + dateData.reduce((sum, count) => sum + count.count, 0), 0)
                : 0
            }
          </div>
          <div className="text-gray-400">
            {selectedHistoricalDate ? `${selectedHistoricalDate} Numbers` : 'Total Historical Numbers'}
          </div>
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
