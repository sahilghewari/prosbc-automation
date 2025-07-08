import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import NapCreator from './components/NapCreator';
import NapCreatorEnhanced from './components/NapCreatorEnhanced';
import NapManager from './components/NapManager';
import NapManagerEnhanced from './components/NapManagerEnhanced';
import FileUploader from './components/FileUploader';
import FileManagement from './components/FileManagement';
import RoutesetMapping from './components/RoutesetMapping';
import ActivationGeneration from './components/ActivationGeneration';
import DatabaseStatus from './components/DatabaseStatus';
import DatabaseWidget from './components/DatabaseWidget';
import DatabaseDashboard from './components/DatabaseDashboard';
import EnhancedDatabaseDashboard from './components/EnhancedDatabaseDashboard';

import { setupAuthentication } from './utils/napApiClientFixed';
import './App.css';

function App() {
  const [activeSection, setActiveSection] = useState('nap-creation');
  const [isReady, setIsReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDatabaseDashboard, setShowDatabaseDashboard] = useState(false);

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

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 pt-16">
        <Navbar />
        <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
          <div className="bg-gray-800 border border-gray-700 p-8 rounded-xl shadow-2xl max-w-md w-full mx-4 backdrop-blur-sm">
            {authError ? (
              <div className="text-center">
                <div className="text-red-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Configuration Error</h3>
                <p className="text-gray-300 mb-4">{authError}</p>
                <p className="text-sm text-gray-400">Please ensure you have set VITE_PROSBC_USERNAME and VITE_PROSBC_PASSWORD in your .env file.</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-blue-400 mb-4">
                  <svg className="w-16 h-16 mx-auto animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Initializing...</h3>
                <p className="text-gray-300">Setting up authentication...</p>
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
      case 'database-status':
        return <DatabaseStatus showDetails={true} />;
      case 'nap-creation':
        return <NapCreatorEnhanced onAuthError={handleAuthError} />;
      case 'nap-management':
        return <NapManagerEnhanced onAuthError={handleAuthError} />;
      case 'dm-df-upload':
        return <FileUploader onAuthError={handleAuthError} />;
      case 'dm-df-management':
        return <FileManagement onAuthError={handleAuthError} />;
      case 'routeset-mapping':
        return <RoutesetMapping onAuthError={handleAuthError} />;
      case 'activation-generation':
        return <ActivationGeneration onAuthError={handleAuthError} />;
      case 'database-dashboard':
        return <DatabaseDashboard onClose={() => setActiveSection('nap-creation')} />;
      case 'system-dashboard':
        return <EnhancedDatabaseDashboard />;
      default:
        return <NapCreatorEnhanced onAuthError={handleAuthError} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Navbar />
      <Sidebar 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
        onCollapseChange={setSidebarCollapsed}
      />
      
     
      
     
      
     
      
      <main className={`${sidebarCollapsed ? 'ml-16' : 'ml-64'} bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-[calc(100vh-4rem)] transition-all duration-300 pt-16`}>
        <div className="p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}

export default App;
