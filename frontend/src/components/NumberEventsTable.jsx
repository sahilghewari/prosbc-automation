import React, { useEffect, useState } from 'react';
import { useProSBCInstance } from '../contexts/ProSBCInstanceContext';

const DateInput = ({ value, onChange, placeholder }) => (
  <input type="date" value={value || ''} onChange={e => onChange(e.target.value)} className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-sm text-white" placeholder={placeholder} />
);

const NumberEventsTable = ({ configId }) => {
  const { selectedInstance } = useProSBCInstance();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [userName, setUserName] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [number, setNumber] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);

  const fetchEvents = async (opts = {}) => {
    if (!selectedInstance) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('dashboard_token');
  const params = new URLSearchParams();
      params.set('instanceId', selectedInstance.id);
      if (customerName) params.set('customerName', customerName);
      if (userName) params.set('userName', userName);
  if (actionFilter) params.set('action', actionFilter);
      if (number) params.set('number', number);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('page', opts.page || page);
      params.set('pageSize', opts.pageSize || pageSize);

      const res = await fetch(`/backend/api/customer-counts/number-events?${params.toString()}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(data.events || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
    } catch (err) {
      console.error('Failed to fetch number events', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // auto-fetch when instance changes
    setPage(1);
    fetchEvents({ page: 1 });
  }, [selectedInstance]);

  const onSearch = () => {
    setPage(1);
    fetchEvents({ page: 1 });
  };

  const onReset = () => {
    setCustomerName(''); setUserName(''); setNumber(''); setFrom(''); setTo(''); setPage(1);
    fetchEvents({ page: 1 });
  };

  const exportCSV = async () => {
    if (!selectedInstance) return;
    try {
      const token = localStorage.getItem('dashboard_token');
      const params = new URLSearchParams();
      params.set('instanceId', selectedInstance.id);
      if (customerName) params.set('customerName', customerName);
      if (userName) params.set('userName', userName);
      if (number) params.set('number', number);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      // request large pageSize to export many rows (server caps at 1000)
      params.set('page', 1);
      params.set('pageSize', 1000);

      const res = await fetch(`/backend/api/customer-counts/number-events?${params.toString()}`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rows = data.events || [];

      // Convert to CSV
      const header = ['id','timestamp','action','number','customerName','prosbcInstanceId','userId','userName','fileName','details'];
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
      a.download = `number-events-${selectedInstance.id}-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed', err);
      setError(err.message);
    }
  };

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Audit Logs (Detailed)</h1>

      <div className="bg-gray-900 p-4 rounded-lg mb-4 border border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-sm text-white" placeholder="Customer name" value={customerName} onChange={e=>setCustomerName(e.target.value)} />
          <input className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-sm text-white" placeholder="User name" value={userName} onChange={e=>setUserName(e.target.value)} />
          <input className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-sm text-white" placeholder="Number" value={number} onChange={e=>setNumber(e.target.value)} />
          <div className="flex gap-2">
            <DateInput value={from} onChange={setFrom} placeholder="From" />
            <DateInput value={to} onChange={setTo} placeholder="To" />
          </div>
          <select className="bg-gray-800 border border-gray-700 px-2 py-1 rounded text-sm text-white" value={actionFilter} onChange={e=>setActionFilter(e.target.value)}>
            <option value="">All actions</option>
            <option value="add">Add</option>
            <option value="remove">Remove</option>
            <option value="update">Update</option>
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={onSearch} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Search</button>
          <button onClick={onReset} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded">Reset</button>
          <button onClick={exportCSV} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">Export CSV</button>
        </div>
      </div>

      <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
        {error && <div className="text-red-400 mb-2">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-sm">
            <thead>
              <tr className="text-left text-gray-300 sticky top-0 bg-gray-900 z-10">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Number</th>
                <th className="px-3 py-2">Who</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-400">Loading…</td></tr>
              ) : events.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">No events found</td></tr>
              ) : (
                events.map(ev => (
                  <tr key={ev.id} className="border-t border-gray-800">
                    <td className="px-3 py-2 text-gray-300">{new Date(ev.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2 text-gray-100">{ev.customerName}</td>
                    <td className="px-3 py-2 text-gray-200">{ev.action}</td>
                    <td className="px-3 py-2 text-gray-200">{ev.number}</td>
                    <td className="px-3 py-2 text-gray-200">{ev.userName || ev.userId || 'system'}</td>
                    <td className="px-3 py-2 text-gray-400 truncate max-w-xs">{ev.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-sm text-gray-300">
          <div>Showing page {page} of {totalPages} — {total} events</div>
          <div className="flex items-center gap-2">
            <label className="text-xs">Page size</label>
            <select value={pageSize} onChange={e => { setPageSize(parseInt(e.target.value)); fetchEvents({ page: 1, pageSize: parseInt(e.target.value) }); }} className="bg-gray-800 border border-gray-700 px-2 py-1 rounded">
              {[25,50,100,200].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button disabled={page<=1} onClick={() => { setPage(p=>Math.max(1,p-1)); fetchEvents({ page: page-1 }); }} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Prev</button>
            <button disabled={page>=totalPages} onClick={() => { setPage(p=>p+1); fetchEvents({ page: page+1 }); }} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NumberEventsTable;
