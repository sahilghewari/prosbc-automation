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
      id: 'nap-tester',
      title: 'NAP API Tester',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    },
    {
      id: 'dm-df-upload',
      title: 'Combined File Upload',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      subtitle: 'DF & DM Files in one interface'
    },
    {
      id: 'df-manager',
      title: 'DF Manager',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      subtitle: 'Definition Files Upload'
    },
    {
      id: 'dm-manager',
      title: 'DM Manager',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      subtitle: 'Digit Map Files Upload'
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
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
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
    }
  ];

  return (
    <div className={`fixed left-0 top-16 bg-gray-800 text-white transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'} h-[calc(100vh-4rem)] overflow-y-auto`}>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold">Navigation</h2>
          )}
          <button
            onClick={handleCollapseToggle}
            className="text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-gray-600 rounded p-1"
          >
            <svg 
              className={`w-5 h-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} 
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
      <nav className="mt-4">
        <ul className="space-y-1">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onSectionChange?.(item.id)}
                className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-700 transition-colors ${
                  activeSection === item.id ? 'bg-blue-600 border-r-4 border-blue-400' : ''
                }`}
                title={isCollapsed ? item.title : ''}
              >
                <span className="flex-shrink-0">
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <div className="ml-3">
                    <span className="block text-sm font-medium">
                      {item.title}
                    </span>
                    {item.subtitle && (
                      <span className="block text-xs text-gray-400 mt-1">
                        {item.subtitle}
                      </span>
                    )}
                  </div>
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