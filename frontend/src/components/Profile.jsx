// Helper to get auth headers

import React, { useState } from 'react';

const Profile = ({ user, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleEdit = () => {
    setEditing(true);
    setSuccess(null);
    setError(null);
  };
const getAuthHeaders = () => {
  const token = localStorage.getItem('dashboard_token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
};
  const handleCancel = () => {
    setEditing(false);
    setUsername(user.username);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/backend/api/auth/profile`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Update failed');
      }
      setSuccess('Username updated successfully!');
      setEditing(false);
      if (onUpdate) onUpdate({ ...user, username });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed top-20 right-8 z-50">
      <div className="profile-container bg-gradient-to-br from-gray-800 via-gray-900 to-gray-950 border border-gray-700 p-6 rounded-2xl shadow-2xl w-80 relative">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-700 flex items-center justify-center text-2xl font-bold text-white mr-3 shadow-lg">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Profile</h2>
            <div className="text-xs text-gray-400">Dashboard User</div>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-gray-400 mb-1 text-sm">Username</label>
          {editing ? (
            <input
              className="w-full p-2 rounded bg-gray-800 text-white border border-gray-700 focus:border-blue-500 text-sm"
              value={username}
              onChange={e => setUsername(e.target.value)}
              disabled={isLoading}
            />
          ) : (
            <div className="text-base text-white font-medium">{user.username}</div>
          )}
        </div>
        {error && <div className="text-red-400 mb-2 text-sm">{error}</div>}
        {success && <div className="text-green-400 mb-2 text-sm">{success}</div>}
        <div className="flex space-x-2 justify-end">
          {editing ? (
            <>
              <button className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm" onClick={handleSave} disabled={isLoading}>Save</button>
              <button className="bg-gray-700 text-white px-3 py-1.5 rounded hover:bg-gray-600 text-sm" onClick={handleCancel} disabled={isLoading}>Cancel</button>
            </>
          ) : (
            <button className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm" onClick={handleEdit}>Edit</button>
          )}
        </div>
        {/* Add close button at top right of card */}
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-white text-xl"
          onClick={() => onUpdate && onUpdate(null)}
          title="Close"
        >
          &times;
        </button>
      </div>
    </div>
  );
};

export default Profile;
