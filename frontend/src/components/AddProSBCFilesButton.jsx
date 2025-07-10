import React, { useState } from 'react';
import { ClientDatabaseService } from '../services/apiClient';
import { prosbcFileAPI } from '../utils/prosbcFileApi';

const clientDbService = new ClientDatabaseService();

function AddProSBCFilesButton({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  // Helper to fetch file content as text from exportUrl
  const fetchFileContent = async (exportUrl) => {
    // Prompt for credentials if not already set
    // Use credentials from Vite env variables
    const username = import.meta.env.VITE_PROSBC_USERNAME;
    const password = import.meta.env.VITE_PROSBC_PASSWORD;
    if (!username || !password) {
      alert('ProSBC credentials are missing in your .env file!');
      throw new Error('Missing ProSBC credentials');
    }
    const basicAuth = 'Basic ' + btoa(username + ':' + password);
    const response = await fetch(exportUrl, {
      method: 'GET',
      headers: {
        ...prosbcFileAPI.getCommonHeaders(),
        'Authorization': basicAuth
      }
    });
    if (!response.ok) {
      // Optionally log to console for debugging
      console.warn('Fetch failed:', response.status, response.statusText, exportUrl);
      throw new Error('Failed to fetch file content');
    }
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    // Optionally log debug info
    console.log('Fetched file debug:', {
      url: exportUrl,
      contentType,
      preview: text.slice(0, 200)
    });
    // Frontend validation: block HTML or empty or non-CSV
    if (!text.trim()) throw new Error('Fetched file is empty');
    if (text.trim().startsWith('<!DOCTYPE html') || text.trim().startsWith('<html')) {
      throw new Error('Fetched file is HTML, not CSV');
    }
    // Optionally: check for CSV header (basic check)
    const firstLine = text.split('\n')[0];
    if (!firstLine.includes(',') && !firstLine.toLowerCase().includes('dm') && !firstLine.toLowerCase().includes('df')) {
      throw new Error('Fetched file does not appear to be a valid CSV');
    }
    if (!contentType.includes('csv') && !contentType.includes('text/plain')) {
      throw new Error('Fetched file is not a CSV (content-type: ' + contentType + ')');
    }
    return text;
  };


  const handleAddFiles = async () => {
    setLoading(true);
    setResults(null);
    try {
      // 1. Fetch DM and DF file lists from ProSBC
      const [dfResult, dmResult] = await Promise.all([
        prosbcFileAPI.listDfFiles(),
        prosbcFileAPI.listDmFiles()
      ]);
      const dfFiles = (dfResult.files || []).map(f => ({ ...f, type: 'df' }));
      const dmFiles = (dmResult.files || []).map(f => ({ ...f, type: 'dm' }));

      // 2. Download file content for each DF file
      const dfFilesToStore = await Promise.all(
        dfFiles.map(async (f) => {
          try {
            const content = await fetchFileContent(f.exportUrl);
            return {
              file: new File([content], f.name, { type: 'text/csv' }),
              type: f.type,
              name: f.name,
              nap_id: f.nap_id,
              tags: f.tags,
              uploaded_by: 'user'
            };
          } catch (err) {
            return { error: err.message, name: f.name };
          }
        })
      );

      // 3. Download file content for each DM file
      const dmFilesToStore = await Promise.all(
        dmFiles.map(async (f) => {
          try {
            const content = await fetchFileContent(f.exportUrl);
            return {
              file: new File([content], f.name, { type: 'text/csv' }),
              type: f.type,
              name: f.name,
              nap_id: f.nap_id,
              tags: f.tags,
              uploaded_by: 'user'
            };
          } catch (err) {
            return { error: err.message, name: f.name };
          }
        })
      );

      // 4. Store DF files in database (skip errored downloads)
      const validDfFiles = dfFilesToStore.filter(f => !f.error);
      const dfUploadResults = validDfFiles.length > 0
        ? await clientDbService.storeFetchedProSBCFiles(validDfFiles)
        : [];
      // Merge download errors and upload results for DF
      const dfResults = dfFilesToStore.map((f, idx) => {
        if (f.error) return { success: false, file: f.name, error: f.error };
        return dfUploadResults[idx] || { success: false, file: f.name, error: 'Upload failed' };
      });

      // 5. Store DM files in database (skip errored downloads)
      const validDmFiles = dmFilesToStore.filter(f => !f.error);
      const dmUploadResults = validDmFiles.length > 0
        ? await clientDbService.storeFetchedProSBCFiles(validDmFiles)
        : [];
      // Merge download errors and upload results for DM
      const dmResults = dmFilesToStore.map((f, idx) => {
        if (f.error) return { success: false, file: f.name, error: f.error };
        return dmUploadResults[idx] || { success: false, file: f.name, error: 'Upload failed' };
      });

      setResults({ dfResults, dmResults });
      if (onComplete) onComplete({ dfResults, dmResults });
    } catch (err) {
      setResults({ dfResults: [{ success: false, error: err.message }], dmResults: [] });
    }
    setLoading(false);
  };

  return (
    <div className="my-4">
      <button
        onClick={handleAddFiles}
        disabled={loading}
        className="px-4 py-2 rounded-lg bg-green-700 text-white font-semibold hover:bg-green-800 disabled:bg-gray-600"
      >
        {loading ? 'Adding Files...' : 'Add Fetched ProSBC Files to Database'}
      </button>
      {results && (
        <div className="mt-3 text-sm">
          <div className="mb-2 font-bold text-purple-300">DF Upload Results</div>
          <ul>
            {results.dfResults.map((res, idx) => (
              <li key={idx} style={{ color: res.success ? 'green' : 'red' }}>
                {res.file}: {res.success ? 'Success' : `Error: ${res.error}`}
              </li>
            ))}
          </ul>
          <div className="mb-2 mt-4 font-bold text-pink-300">DM Upload Results</div>
          <ul>
            {results.dmResults.map((res, idx) => (
              <li key={idx} style={{ color: res.success ? 'green' : 'red' }}>
                {res.file}: {res.success ? 'Success' : `Error: ${res.error}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default AddProSBCFilesButton;
