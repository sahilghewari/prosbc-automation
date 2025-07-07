import React, { useState } from 'react';
import './LoginForm.css';

const LoginForm = ({ onLogin, isLoading, error }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    serverUrl: 'https://prosbc2tpa2.dipvtel.com:12358'
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
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>ProSBC Login</h2>
        <p className="login-description">
          Enter your ProSBC credentials to manage Network Access Points (NAPs).
          <br />
          <small style={{color: '#666', fontSize: '14px'}}>
            Note: The server URL is configured via proxy. Contact your admin if you need to connect to a different ProSBC server.
          </small>
        </p>

        <div className="form-group" style={{display: 'none'}}>
          <label htmlFor="serverUrl">Server URL</label>
          <input
            type="url"
            id="serverUrl"
            name="serverUrl"
            value={credentials.serverUrl}
            onChange={handleChange}
            placeholder="https://your-prosbc-server:port"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={credentials.username}
            onChange={handleChange}
            placeholder="Username"
            required
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
            placeholder="Password"
            required
          />
        </div>

        {error && <div className="login-error">{error}</div>}

        <button 
          type="submit" 
          className="login-button" 
          disabled={isLoading}
        >
          {isLoading ? 'Connecting...' : 'Login to ProSBC'}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
