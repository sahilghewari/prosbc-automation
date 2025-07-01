import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import NapCreator from './components/NapCreator';
import NapManager from './components/NapManager';
import NapTester from './components/NapTester';
import FileUploader from './components/FileUploader';
import FileManagement from './components/FileManagement';
import DfManager from './components/DfManager';
import DmManager from './components/DmManager';
import { setupAuthentication } from './utils/napApiClientFixed';
import './App.css';

function App() {
  const [activeSection, setActiveSection] = useState('nap-creation');
  const [isReady, setIsReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Initialize authentication on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await setupAuthentication();
        setIsReady(true);
        setAuthError(null);
      } catch (error) {
        console.error('Authentication setup failed:', error);
        setAuthError(error.message);
      }
    };

    initializeAuth();
  }, []);

  const handleAuthError = () => {
    setAuthError('Authentication required. Please check your .env file credentials.');
  };

  // Show loading or error state if not ready
  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-100 pt-16">
        <Navbar />
        <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
            {authError ? (
              <div className="text-center">
                <div className="text-red-500 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Configuration Error</h3>
                <p className="text-gray-600 mb-4">{authError}</p>
                <p className="text-sm text-gray-500">Please ensure you have set VITE_PROSBC_USERNAME and VITE_PROSBC_PASSWORD in your .env file.</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-blue-500 mb-4">
                  <svg className="w-16 h-16 mx-auto animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Initializing...</h3>
                <p className="text-gray-600">Setting up authentication...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render different content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case 'nap-creation':
        return <NapCreator onAuthError={handleAuthError} />;
      case 'nap-management':
        return <NapManager onAuthError={handleAuthError} />;
      case 'nap-tester':
        return <NapTester />;
      case 'dm-df-upload':
        return <FileUploader onAuthError={handleAuthError} />;
      case 'dm-df-management':
        return <FileManagement onAuthError={handleAuthError} />;
      case 'df-manager':
        return <DfManager onAuthError={handleAuthError} />;
      case 'dm-manager':
        return <DmManager onAuthError={handleAuthError} />;
      case 'routeset-mapping':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Routeset Mapping</h2>
            <p className="text-gray-600 mb-2">Mapping of Routeset files and NAP</p>
            <p className="text-gray-500">This section will handle the mapping between routeset files and NAP configurations.</p>
          </div>
        );
      case 'activation-generation':
        return (
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Activation and Generation</h2>
            <p className="text-gray-600">This section will handle activation and generation processes.</p>
          </div>
        );
      default:
        return <NapCreator onAuthError={handleAuthError} />;
    }
  };

  // Show main app if ready
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <Sidebar 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
        onCollapseChange={setSidebarCollapsed}
      />
      <main className={`${sidebarCollapsed ? 'ml-16' : 'ml-64'} bg-white min-h-[calc(100vh-4rem)] transition-all duration-300 pt-16`}>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;
