import React, { useState, useEffect } from 'react';
import { getDBHealth } from '../database/client-api.js';
import './Navbar.css';

const Navbar = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState('connecting');

  useEffect(() => {
    const checkDbStatus = async () => {
      try {
        const health = await getDBHealth();
        setDbStatus(health.status === 'healthy' ? 'connected' : 'error');
      } catch (error) {
        setDbStatus('disconnected');
      }
    };

    checkDbStatus();
    const interval = setInterval(checkDbStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const getDbStatusColor = () => {
    switch (dbStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500 animate-pulse';
      case 'error': return 'bg-orange-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

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

          {/* Database Status & Profile */}
          <div className="flex items-center space-x-4">
            {/* Database Status Indicator */}
            <div className="flex items-center space-x-2 px-3 py-1 bg-gray-800 rounded-full border border-gray-600">
              <div className={`w-2 h-2 rounded-full ${getDbStatusColor()}`}></div>
              <span className="text-xs text-gray-300 hidden sm:block">
                Database {dbStatus === 'connected' ? 'Connected' : dbStatus === 'connecting' ? 'Connecting...' : 'Offline'}
              </span>
            </div>

            {/* Profile Icon with Dropdown */}
            <div className="relative profile-menu">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-800 rounded-full p-2 transition-all duration-200 hover:bg-gray-700"
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

            {/* Dropdown Menu */}
            {isProfileOpen && (
              <div className="profile-dropdown bg-gray-800 border border-gray-600 shadow-2xl">
                <a href="#" onClick={() => setIsProfileOpen(false)} className="text-gray-300 hover:text-white hover:bg-gray-700">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </a>
                <a href="#" onClick={() => setIsProfileOpen(false)} className="text-gray-300 hover:text-white hover:bg-gray-700">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </a>
                <div className="border-t border-gray-600 my-1"></div>
                <a href="#" onClick={() => setIsProfileOpen(false)} className="text-red-400 hover:text-red-300 hover:bg-gray-700">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Logout
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Click outside to close dropdown */}
      {isProfileOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsProfileOpen(false)}
        ></div>
      )}
    </nav>
  );
};

export default Navbar;