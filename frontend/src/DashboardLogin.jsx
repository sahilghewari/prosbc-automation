import React, { useState } from 'react';
import DashboardLoginForm from './components/DashboardLoginForm';

const DashboardLogin = ({ onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [overridePrompt, setOverridePrompt] = useState(null);

  const handleLogin = async (credentials, override = false) => {
    setIsLoading(true);
    setError(null);
    setOverridePrompt(null);
    try {
      // Use the backend login endpoint
      const response = await fetch('/backend/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credentials, override })
      });
      const data = await response.json();
      if (!response.ok) {
        // Check for active user prompt
        if (data.canOverride && data.activeUser) {
          setOverridePrompt({
            message: data.message,
            credentials
          });
          return;
        }
        throw new Error(data.message || 'Login failed');
      }
      if (onSuccess) onSuccess(data.token || 'mock_token');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DashboardLoginForm onLogin={handleLogin} isLoading={isLoading} error={error} />
      {overridePrompt && (
        <div className="mt-4 bg-yellow-900/30 border border-yellow-700 text-yellow-300 text-sm px-3 py-2 rounded max-w-md mx-auto">
          <div>{overridePrompt.message}</div>
          <button
            className="mt-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded"
            onClick={() => handleLogin(overridePrompt.credentials, true)}
            disabled={isLoading}
          >
            Override and Login
          </button>
        </div>
      )}
    </>
  );
};

export default DashboardLogin;
