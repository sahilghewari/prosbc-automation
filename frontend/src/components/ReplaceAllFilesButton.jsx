import React, { useState } from 'react';

function ReplaceAllFilesButton({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleReplaceAll = async () => {
    if (!window.confirm('This will delete ALL DM and DF files and add new ones. Continue?')) return;
    setLoading(true);
    setResult(null);
    try {
      // 1. Delete all files
      const delRes = await fetch('/backend/api/files/delete-all', { method: 'DELETE' });
      const delData = await delRes.json();
      if (!delData.success) throw new Error(delData.message || 'Delete failed');

      // 2. Add new files (call your import/fetch endpoint)
      const importRes = await fetch('/backend/api/files/prosbc/import', { method: 'POST' });
      const importData = await importRes.json();
      setResult(importData);
      if (onComplete) onComplete();
    } catch (err) {
      setResult({ success: false, message: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="inline-block ml-2">
      <button
        onClick={handleReplaceAll}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-yellow-700 text-white font-semibold hover:bg-yellow-800 disabled:bg-gray-600"
      >
        {loading ? 'Replacing...' : 'Replace All Files (Delete + Add)'}
      </button>
      {result && (
        <div className="mt-2 text-sm" style={{ color: result.success ? 'green' : 'red' }}>
          {result.message}
        </div>
      )}
    </div>
  );
}

export default ReplaceAllFilesButton;
