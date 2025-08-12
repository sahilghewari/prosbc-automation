import React, { useState } from 'react';
import './AuthForm.css';

const DashboardAuth = ({ onSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const validateForm = () => {
    if (!credentials.username || !credentials.password) {
      setError('Username and password are required.');
      return false;
    }

    if (credentials.username.length < 3) {
      setError('Username must be at least 3 characters long.');
      return false;
    }

    if (credentials.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return false;
    }

    if (mode === 'signup' && credentials.password !== credentials.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const endpoint = mode === 'login' ? '/backend/api/auth/login' : '/backend/api/auth/signup';
      const payload = {
        username: credentials.username,
        password: credentials.password
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `${mode} failed`);
      }

      if (mode === 'signup') {
        setSuccess('Account created successfully! You are now logged in.');
      } else {
        setSuccess('Login successful!');
      }

      // Call success callback with token
      if (onSuccess && data.token) {
        setTimeout(() => {
          onSuccess(data.token);
        }, 1000); // Brief delay to show success message
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setCredentials({
      username: '',
      password: '',
      confirmPassword: ''
    });
    setError(null);
    setSuccess(null);
  };

  const isSignupMode = mode === 'signup';

  return (
    <div className="auth-container">
      <div className="auth-form">
        <div className="auth-header">
          <h2>{isSignupMode ? 'Create Account' : 'Dashboard Login'}</h2>
          <p className="auth-description">
            {isSignupMode 
              ? 'Create a new account to access the ProSBC management system.'
              : 'Enter your credentials to access the ProSBC management system.'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              placeholder="Enter your username"
              required
              minLength={3}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              placeholder="Enter your password"
              required
              minLength={6}
              autoComplete={isSignupMode ? "new-password" : "current-password"}
            />
          </div>

          {isSignupMode && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={credentials.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
          )}

          {error && (
            <div className="auth-message auth-error">
              <svg className="message-icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {success && (
            <div className="auth-message auth-success">
              <svg className="message-icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              {success}
            </div>
          )}

          <button 
            type="submit" 
            className="auth-button" 
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="loading-spinner" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {isSignupMode ? 'Creating Account...' : 'Logging in...'}
              </>
            ) : (
              isSignupMode ? 'Create Account' : 'Login'
            )}
          </button>
        </form>

        <div className="auth-switch">
          <p>
            {isSignupMode ? 'Already have an account?' : "Don't have an account?"}
            <button 
              type="button" 
              className="auth-switch-button" 
              onClick={switchMode}
              disabled={isLoading}
            >
              {isSignupMode ? 'Login here' : 'Sign up here'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardAuth;
