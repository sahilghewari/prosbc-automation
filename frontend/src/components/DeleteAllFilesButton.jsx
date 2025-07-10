import React, { useState } from 'react';

function DeleteAllFilesButton({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleDeleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL DM and DF files from the database?')) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/backend/api/files/delete-all', { method: 'DELETE' });
      const data = await res.json();
      setResult(data);
      if (onComplete) onComplete();
    } catch (err) {
      setResult({ success: false, message: err.message });
    }
    setLoading(false);
  };

  return (
    <div className="inline-block ml-2">
      <button
        onClick={handleDeleteAll}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-red-700 text-white font-semibold hover:bg-red-800 disabled:bg-gray-600"
      >
        {loading ? 'Deleting...' : 'Delete All Files in Database'}
      </button>
      {result && (
        <div className="mt-2 text-sm" style={{ color: result.success ? 'green' : 'red' }}>
          {result.message}
        </div>
      )}
    </div>
  );
}

export default DeleteAllFilesButton;
