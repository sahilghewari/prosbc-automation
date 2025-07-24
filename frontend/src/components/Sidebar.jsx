import React, { useState } from 'react';
import './Sidebar.css';

const Sidebar = ({ activeSection, onSectionChange, onCollapseChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleCollapseToggle = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    onCollapseChange?.(newCollapsedState);
  };

  const menuItems = [
    {
      id: 'nap-creation',
      title: 'NAP Creation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      )
    },
    {
      id: 'nap-management',
      title: 'NAP Management',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    {
      id: 'dm-df-upload',
      title: 'File Upload',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      subtitle: 'DF & DM Files in one interface'
    },
    {
      id: 'dm-df-management',
      title: '🗂️ File Management Center',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H15a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
      ),
      subtitle: 'Comprehensive DM & DF file management'
    },
    
    {
      id: 'routeset-mapping',
      title: 'Routeset Mapping',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 113 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      ),
      subtitle: 'Mapping of Routeset files and NAP'
    },
    {
      id: 'activation-generation',
      title: 'Activation and Generation',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
 
   
   
  ];

  return (
    <div className={`fixed left-0 top-16 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 text-white transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} h-[calc(100vh-4rem)] overflow-y-auto border-r border-gray-700 shadow-2xl backdrop-blur-sm`}>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Navigation</h2>
          )}
          <button
            onClick={handleCollapseToggle}
            className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg p-2 transition-all duration-200 hover:bg-gray-700"
          >
            <svg 
              className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="mt-4 px-2">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onSectionChange?.(item.id)}
                className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-all duration-200 group ${
                  activeSection === item.id 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg transform scale-105' 
                    : 'hover:bg-gray-700 hover:transform hover:scale-102'
                }`}
                title={isCollapsed ? item.title : ''}
              >
                <span className={`flex-shrink-0 transition-colors duration-200 ${
                  activeSection === item.id ? 'text-white' : 'text-gray-400 group-hover:text-white'
                }`}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <div className="ml-3 overflow-hidden">
                    <span className={`block text-sm font-medium transition-colors duration-200 ${
                      activeSection === item.id ? 'text-white' : 'text-gray-300 group-hover:text-white'
                    }`}>
                      {item.title}
                    </span>
                    {item.subtitle && (
                      <span className={`block text-xs mt-1 transition-colors duration-200 ${
                        activeSection === item.id ? 'text-blue-100' : 'text-gray-500 group-hover:text-gray-300'
                      }`}>
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                )}
                {activeSection === item.id && (
                  <div className="absolute right-0 w-1 h-8 bg-gradient-to-b from-blue-400 to-purple-400 rounded-l-full"></div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
