import React from 'react';
import ProSBCFilesManagement from '../components/ProSBCFilesManagement';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';

const ProSBCFilesPage = () => {
  return (
    <div className="app-container">
      <Navbar />
      <div className="content-container">
        <Sidebar />
        <div className="main-content">
          <h1 className="page-title">ProSBC Files Management</h1>
          <div className="page-content">
            <ProSBCFilesManagement />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProSBCFilesPage;
