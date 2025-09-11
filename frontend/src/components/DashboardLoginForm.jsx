import React, { useState } from 'react';

const DashboardLoginForm = ({ onLogin, isLoading, error }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(credentials);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-700 rounded-xl p-6 shadow-2xl">
        <h2 className="text-2xl font-bold text-white">Dashboard Login</h2>
        <p className="text-gray-300 mt-1 text-sm">
          Enter your dashboard credentials to access the management system.
        </p>
        <div className="mt-5">
          <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={credentials.username}
            onChange={handleChange}
            placeholder="Username"
            required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="mt-4">
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={credentials.password}
            onChange={handleChange}
            placeholder="Password"
            required
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-700 text-red-300 text-sm px-3 py-2 rounded">
            {error}
          </div>
        )}
        <button 
          type="submit"
          disabled={isLoading}
          className={`mt-5 w-full inline-flex items-center justify-center px-4 py-2 rounded font-medium text-white transition-colors ${isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default DashboardLoginForm;
