import React, { useEffect, useState } from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';

const DashboardSidebar = ({ configId, user }) => {
  const { selectedInstance } = useProSBCInstance();
  const [analytics, setAnalytics] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [dataSource, setDataSource] = useState('live_calculation');

  const fetchAnalytics = async () => {
    if (!selectedInstance) return;
    setLoadingAnalytics(true);
    try {
      const token = localStorage.getItem('dashboard_token');
      const res = await fetch(`/backend/api/customer-counts/analytics?instanceId=${selectedInstance.id}&year=${selectedYear}&month=${selectedMonth}&limit=50`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const data = await res.json();
      setAnalytics(data.analytics || []);
      setDataSource(data.dataSource || 'live_calculation');
    } catch (err) {
      console.error('Failed to fetch analytics', err);
      setAnalytics([]);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchAvailableMonths = async () => {
    if (!selectedInstance) return;
    try {
      const token = localStorage.getItem('dashboard_token');
      const res = await fetch(`/backend/api/customer-counts/historical?instanceId=${selectedInstance.id}&limit=24`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableMonths(data.availableMonths || []);
      }
    } catch (err) {
      console.error('Failed to fetch available months', err);
    }
  };

  useEffect(() => {
    fetchAvailableMonths();
    fetchAnalytics();
  }, [configId, selectedInstance, selectedYear, selectedMonth]);

  const totalLive = analytics.reduce((sum, a) => sum + (a.liveCount || 0), 0);
  const totalUsed = analytics.reduce((sum, a) => sum + (a.usedThisMonth || 0), 0);
  const totalAdded = analytics.reduce((sum, a) => sum + (a.addedCount || 0), 0);
  const totalRemoved = analytics.reduce((sum, a) => sum + (a.removedCount || 0), 0);

  return (
    <div className="p-6 text-sm text-gray-200 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl border border-gray-600 shadow-2xl min-h-screen">
      <div className="flex items-center mb-6">
        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
          <span className="text-white font-bold text-lg">📊</span>
        </div>
        <h3 className="text-xl font-bold text-white bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          Analytics Dashboard
        </h3>
      </div>

      {/* Month/Year Selector */}
      <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Select Billing Period</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>
                  {new Date(2000, month - 1).toLocaleDateString('en-US', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Data: <span className={`font-medium ${dataSource === 'historical_snapshot' ? 'text-green-400' : 'text-blue-400'}`}>
              {dataSource === 'historical_snapshot' ? 'Historical' : 'Live'}
            </span>
          </span>
          {availableMonths.length > 0 && (
            <span className="text-xs text-gray-500">
              {availableMonths.length} months available
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-4 rounded-lg border border-blue-700">
          <div className="text-xs text-blue-300 font-medium">Total Billed This Month</div>
          <div className="text-2xl font-bold text-blue-100">{totalUsed.toLocaleString()}</div>
          <div className="text-xs text-blue-400 mt-1">Live + Added numbers</div>
        </div>
        <div className="bg-gradient-to-r from-green-900 to-green-800 p-4 rounded-lg border border-green-700">
          <div className="text-xs text-green-300 font-medium">Currently Live Numbers</div>
          <div className="text-2xl font-bold text-green-100">{totalLive.toLocaleString()}</div>
          <div className="text-xs text-green-400 mt-1">Active from ProSBC</div>
        </div>
        <div className="bg-gradient-to-r from-yellow-900 to-yellow-800 p-4 rounded-lg border border-yellow-700">
          <div className="text-xs text-yellow-300 font-medium">Numbers Added</div>
          <div className="text-2xl font-bold text-yellow-100">{totalAdded.toLocaleString()}</div>
          <div className="text-xs text-yellow-400 mt-1">During this month</div>
        </div>
        <div className="bg-gradient-to-r from-red-900 to-red-800 p-4 rounded-lg border border-red-700">
          <div className="text-xs text-red-300 font-medium">Numbers Removed</div>
          <div className="text-2xl font-bold text-red-100">{totalRemoved.toLocaleString()}</div>
          <div className="text-xs text-red-400 mt-1">During this month</div>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-semibold text-gray-100 flex items-center">
            <span className="mr-2">📈</span>
            Billing Analytics
          </h4>
          <div className="text-xs text-gray-400">
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        <div className="text-xs text-gray-400 mb-2 p-3 bg-blue-900/20 rounded border border-blue-700/50">
          <strong>Simple Billing Logic:</strong> Shows total numbers used during the selected month.
          Billed = Live numbers + Numbers added during month. Each number is counted once.
        </div>

        <div className="max-h-80 overflow-y-auto bg-gray-900/50 rounded-lg p-3 border border-gray-600">
          {loadingAnalytics && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-400">Loading analytics...</span>
            </div>
          )}
          {!loadingAnalytics && analytics.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-2 block">📊</span>
              No analytics data available
            </div>
          )}
          {!loadingAnalytics && analytics.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-300 border-b border-gray-600">
                  <th className="pb-3 font-semibold">Customer</th>
                  <th className="pb-3 font-semibold text-center">Billed</th>
                  <th className="pb-3 font-semibold text-center">Live</th>
                  <th className="pb-3 font-semibold text-center">Added</th>
                  <th className="pb-3 font-semibold text-center">Removed</th>
                </tr>
              </thead>
              <tbody>
                {analytics.map((a, i) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors duration-200">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-gray-100 truncate max-w-32" title={a.customerName}>
                        {a.customerName}
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900/50 text-blue-300 border border-blue-700 font-bold">
                        {a.usedThisMonth ?? 0}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-900/50 text-green-300 border border-green-700">
                        {a.liveCount ?? 0}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-700">
                        {a.addedCount ?? 0}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-900/50 text-red-300 border border-red-700">
                        {a.removedCount ?? 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            onClick={fetchAnalytics}
            disabled={loadingAnalytics}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
          >
            <span className="text-lg">🔄</span>
            {loadingAnalytics ? 'Reloading...' : 'Reload'}
          </button>
          <button
            onClick={async () => {
              if (!selectedInstance) return;
              try {
                const token = localStorage.getItem('dashboard_token');
                const now = new Date();
                const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
                const month = now.getMonth() === 0 ? 12 : now.getMonth();
                const res = await fetch(`/backend/api/customer-counts/analytics?instanceId=${selectedInstance.id}&year=${year}&month=${month}&limit=1000`, {
                  headers: { 'Authorization': token ? `Bearer ${token}` : '' }
                });
                if (!res.ok) throw new Error('Failed to fetch analytics for export');
                const data = await res.json();
                const rows = data.analytics || [];
                const header = ['customerName','prosbcInstanceId','liveCount','usedThisMonth','addedCount','removedCount'];
                const csvParts = [header.join(',')];
                for (const r of rows) {
                  const values = header.map(h => {
                    let v = r[h];
                    if (v === null || v === undefined) return '';
                    v = String(v).replace(/"/g, '""');
                    if (v.indexOf(',') >= 0 || v.indexOf('\n') >= 0) return `"${v}"`;
                    return v;
                  });
                  csvParts.push(values.join(','));
                }
                const blob = new Blob([csvParts.join('\n')], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `analytics-${selectedInstance.id}-${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
              } catch (err) {
                console.error('Analytics export failed', err);
                alert('Export failed: ' + err.message);
              }
            }}
            className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
          >
            <span className="text-lg">📥</span>
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardSidebar;
