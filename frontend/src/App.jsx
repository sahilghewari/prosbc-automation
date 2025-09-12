import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import FileUploader from './components/FileUploader';
import FileManagement from './components/FileManagement';
import RoutesetMapping from './components/RoutesetMapping';
import ActivationGeneration from './components/ActivationGeneration';
import DashboardLogin from './DashboardLogin';
import Profile from './components/Profile';
import ProSBCInstanceManager from './components/ProSBCInstanceManager';
import CustomerCounts from './components/CustomerCounts';

import { setupAuthentication } from './utils/napApiClientFixed';
import { ProSBCInstanceProvider, useProSBCInstance } from './contexts/ProSBCInstanceContext';
import { sessionManager } from './utils/sessionManager';
import './App.css';

function App() {
  return (
    <ProSBCInstanceProvider>
      <AppContent />
    </ProSBCInstanceProvider>
  );
}

function AppContent() {
  const { clearInstanceSelection, refreshInstances } = useProSBCInstance();
  const [activeSection, setActiveSection] = useState('dm-df-upload');
  const [isReady, setIsReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showDatabaseDashboard, setShowDatabaseDashboard] = useState(false);
  const [isDashboardAuth, setIsDashboardAuth] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedConfigId, setSelectedConfigId] = useState('');

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

  // Temporary: check for dashboard auth (replace with real logic)
  useEffect(() => {
    // Example: check localStorage for token
    const token = localStorage.getItem('dashboard_token');
    setIsDashboardAuth(!!token);
  }, []);

  const handleAuthError = () => {
    setAuthError('Authentication required. Please check your .env file credentials.');
  };

  // Move fetchUser and handleLoginSuccess above all JSX usage
  const fetchUser = async (token) => {
    try {
      const response = await fetch('/backend/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
      }
    } catch {}
  };

  const handleLoginSuccess = async (token) => {
    localStorage.setItem('dashboard_token', token);
    setIsDashboardAuth(true);
    setShowLoginModal(false);
    
    // Fetch user profile
    fetchUser(token);
    
    // Trigger ProSBC instances fetch after login
    try {
      await refreshInstances();
      console.log('[App] ProSBC instances refreshed after login');
    } catch (error) {
      console.error('[App] Failed to refresh instances after login:', error);
    }
  };

  // Show error state if authentication setup failed
  if (authError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="bg-red-900 text-white p-8 rounded-xl">
          <h2 className="text-xl font-semibold mb-4">Authentication Error</h2>
          <p>{authError}</p>
        </div>
      </div>
    );
  }

  // Show loading state while initializing
  if (!isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
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
      </div>
    );
  }

  // Enforce login: if not authenticated, show only login page
  if (!isDashboardAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="bg-gray-900 p-8 rounded-xl shadow-2xl relative">
          <DashboardLogin onSuccess={handleLoginSuccess} />
        </div>
      </div>
    );
  }

  // Auth state and handlers
  const handleLogout = () => {
    localStorage.removeItem('dashboard_token');
    clearInstanceSelection(); // Clear ProSBC instance selection
    sessionManager.clearSession(); // Clear ProSBC session cookies
    setIsDashboardAuth(false);
    setShowLoginModal(false);
  };

  // Render different content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case 'dm-df-upload':
        return <FileUploader onAuthError={handleAuthError} configId={selectedConfigId} />;
      case 'dm-df-management':
        return <FileManagement onAuthError={handleAuthError} configId={selectedConfigId} />;
      case 'routeset-mapping':
        return <RoutesetMapping onAuthError={handleAuthError} configId={selectedConfigId} />;
      case 'activation-generation':
        return <ActivationGeneration onAuthError={handleAuthError} />;
      case 'prosbc-instances':
        return <ProSBCInstanceManager />;
      case 'customer-counts':
        return <CustomerCounts configId={selectedConfigId} />;
      default:
        return <FileUploader onAuthError={handleAuthError} configId={selectedConfigId} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Navbar 
        isDashboardAuth={isDashboardAuth}
        onLoginClick={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        onShowProfile={() => setShowProfile(true)}
        user={user}
      />
      <div className="flex">
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onConfigChange={setSelectedConfigId}
        />
        {showLoginModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-xl shadow-2xl relative">
              <button
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
                onClick={() => setShowLoginModal(false)}
              >
                &times;
              </button>
              <DashboardLogin onSuccess={handleLoginSuccess} />
            </div>
          </div>
        )}
        {showProfile && user && (
          <>
            {/* Overlay for click-outside-to-close */}
            <div className="fixed inset-0 z-40" onClick={() => setShowProfile(false)}></div>
            {/* Profile card at top-right, no modal box */}
            <Profile user={user} onUpdate={u => { if (!u) setShowProfile(false); else setUser(u); }} />
          </>
        )}
        <main className={`main-content ${sidebarCollapsed ? 'ml-16' : 'ml-64'} bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 min-h-[calc(100vh-4rem)] transition-all duration-300 pt-16`}>
          <div className="content-container px-4 sm:px-6 lg:px-8 py-6">
            <div className="w-full">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
