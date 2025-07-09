
import React, { useState } from 'react';
import { ClientDatabaseService } from '../services/apiClient';
import { prosbcFileAPI } from '../utils/prosbcFileApi';

const clientDbService = new ClientDatabaseService();

function AddProSBCFilesButton({ onComplete }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  // Helper to fetch file content as text from exportUrl
  const fetchFileContent = async (exportUrl) => {
    const response = await fetch(exportUrl, { method: 'GET', headers: prosbcFileAPI.getCommonHeaders() });
    if (!response.ok) throw new Error('Failed to fetch file content');
    return await response.text();
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
