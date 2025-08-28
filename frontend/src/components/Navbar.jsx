import React, { useState, useEffect } from 'react';
import { getDBHealth } from '../services/apiClient.js';
import InstanceStatusDisplay from './InstanceStatusDisplay';
import './Navbar.css';

const Navbar = ({ onLoginClick, isDashboardAuth, onLogout, onShowProfile }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  

  

  return (
    <nav className="fixed top-0 left-0 right-0 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 shadow-xl border-b border-gray-700 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Brand/Title */}
          <div className="navbar-brand">
            <h1 className="text-white text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              PROSBC AUTOMATION
            </h1>
          </div>

          

          {/* Login/Logout Button and Profile */}
          <div className="flex items-center space-x-4">
            {!isDashboardAuth ? (
              <button
                className="ml-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                onClick={onLoginClick}
              >
                Login
              </button>
            ) : (
              <button
                className="ml-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                onClick={onLogout}
              >
                Logout
              </button>
            )}

            {/* Profile Icon with Dropdown (disabled if not logged in) */}
            <div className="relative profile-menu">
              <button 
                onClick={() => isDashboardAuth && onShowProfile && onShowProfile()}
                className={`flex items-center text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-800 rounded-full p-2 transition-all duration-200 hover:bg-gray-700 ${!isDashboardAuth ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!isDashboardAuth}
              >
                <svg 
                  className="w-7 h-7" 
                  fill="currentColor" 
                  viewBox="0 0 20 20" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    fillRule="evenodd" 
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" 
                    clipRule="evenodd" 
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Click outside to close dropdown */}
      {isProfileOpen && isDashboardAuth && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsProfileOpen(false)}
        ></div>
      )}
    </nav>
  );
};

export default Navbar;