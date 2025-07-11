import React, { useState } from 'react';
import DashboardLoginForm from './components/DashboardLoginForm';

const DashboardLogin = ({ onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async (credentials) => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the backend login endpoint
      const response = await fetch('/backend/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Login failed');
      }
      const data = await response.json();
      if (onSuccess) onSuccess(data.token || 'mock_token');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLoginForm onLogin={handleLogin} isLoading={isLoading} error={error} />
  );
};

export default DashboardLogin;
