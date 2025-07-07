import React, { useState, useEffect } from 'react';
import { fileEditorService } from '../utils/fileEditorService';
import './FileEditor.css';

const FileEditor = ({ file, onSave, onCancel, onError }) => {
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validation, setValidation] = useState({ isValid: true, errors: [], warnings: [] });
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadFileContent();
  }, [file]);

  const loadFileContent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fileEditorService.getFileForEditing(
        file.id,
        file.fileType,
        file.prosbcId
      );
      
      if (result.success) {
        setParsedData(result.parsedData);
        validateContent(result.parsedData);
      } else {
        setError(result.message);
        onError?.(result.message);
      }
    } catch (err) {
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateContent = (data) => {
    const validation = fileEditorService.validateContent(data);
    setValidation(validation);
    return validation;
  };

  const handleCellChange = (rowId, columnIndex, value) => {
    if (!parsedData) return;
    
    const updatedData = { ...parsedData };
    fileEditorService.updateCell(updatedData, rowId, columnIndex, value);
    setParsedData(updatedData);
    setHasChanges(true);
    validateContent(updatedData);
  };

  const handleAddRow = (position = -1) => {
    if (!parsedData) return;
    
    const updatedData = { ...parsedData };
    fileEditorService.addRow(updatedData, position);
    setParsedData(updatedData);
    setHasChanges(true);
    validateContent(updatedData);
  };

  const handleDeleteRow = (rowId) => {
    if (!parsedData) return;
    
    const updatedData = { ...parsedData };
    fileEditorService.deleteRow(updatedData, rowId);
    setParsedData(updatedData);
    setHasChanges(true);
    validateContent(updatedData);
  };

  const handleAddColumn = (headerName, position = -1) => {
    if (!parsedData) return;
    
    const updatedData = { ...parsedData };
    fileEditorService.addColumn(updatedData, headerName, position);
    setParsedData(updatedData);
    setHasChanges(true);
    validateContent(updatedData);
  };

  const handleDeleteColumn = (columnIndex) => {
    if (!parsedData) return;
    
    const updatedData = { ...parsedData };
    fileEditorService.deleteColumn(updatedData, columnIndex);
    setParsedData(updatedData);
    setHasChanges(true);
    validateContent(updatedData);
  };

  const handleSave = async () => {
    if (!parsedData || !validation.isValid) return;
    
    setSaving(true);
    setError(null);
    
    try {
      const result = await fileEditorService.saveToProSBC(
        file.id,
        file.fileType,
        parsedData,
        file.prosbcId
      );
      
      if (result.success) {
        setHasChanges(false);
        onSave?.(result);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        onCancel?.();
      }
    } else {
      onCancel?.();
    }
  };

  if (loading) {
    return (
      <div className="file-editor-loading">
        <div className="spinner"></div>
        <p>Loading file content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-editor-error">
        <h4>Error Loading File</h4>
        <p>{error}</p>
        <button onClick={handleCancel}>Close</button>
      </div>
    );
  }

  if (!parsedData) {
    return (
      <div className="file-editor-error">
        <h4>No Data</h4>
        <p>No file content to display.</p>
        <button onClick={handleCancel}>Close</button>
      </div>
    );
  }

  return (
    <div className="file-editor">
      <div className="file-editor-header">
        <h3>Edit File: {file.fileName}</h3>
        <div className="file-editor-info">
          <span>Type: {file.fileType}</span>
          <span>Format: {parsedData.metadata.isCSV ? 'CSV' : 'Text'}</span>
          <span>Rows: {parsedData.rows.length}</span>
        </div>
      </div>

      {/* Validation Messages */}
      {validation.errors.length > 0 && (
        <div className="validation-errors">
          <h4>❌ Validation Errors:</h4>
          <ul>
            {validation.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="validation-warnings">
          <h4>⚠️ Warnings:</h4>
          <ul>
            {validation.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Table Controls */}
      <div className="table-controls">
        <button onClick={() => handleAddRow()} disabled={saving}>
          ➕ Add Row
        </button>
        <button 
          onClick={() => {
            const headerName = prompt('Enter column header name:');
            if (headerName) handleAddColumn(headerName);
          }}
          disabled={saving}
        >
          ➕ Add Column
        </button>
      </div>

      {/* Editable Table */}
      <div className="file-editor-table-container">
        <table className="file-editor-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>#</th>
              {parsedData.headers.map((header, index) => (
                <th key={index}>
                  <div className="header-cell">
                    <input
                      type="text"
                      value={header}
                      onChange={(e) => {
                        const updatedData = { ...parsedData };
                        updatedData.headers[index] = e.target.value;
                        setParsedData(updatedData);
                        setHasChanges(true);
                      }}
                      className="header-input"
                      disabled={saving}
                    />
                    <button
                      onClick={() => handleDeleteColumn(index)}
                      className="delete-column-btn"
                      disabled={saving}
                      title="Delete column"
                    >
                      ❌
                    </button>
                  </div>
                </th>
              ))}
              <th style={{ width: '80px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {parsedData.rows.map((row, rowIndex) => (
              <tr key={row.id} className={row.isNew ? 'new-row' : row.modified ? 'modified-row' : ''}>
                <td>{rowIndex + 1}</td>
                {parsedData.headers.map((header, columnIndex) => (
                  <td key={columnIndex}>
                    <input
                      type="text"
                      value={row.data[columnIndex] || ''}
                      onChange={(e) => handleCellChange(row.id, columnIndex, e.target.value)}
                      className="cell-input"
                      disabled={saving}
                    />
                  </td>
                ))}
                <td>
                  <button
                    onClick={() => handleAddRow(rowIndex + 1)}
                    className="add-row-btn"
                    disabled={saving}
                    title="Add row after this one"
                  >
                    ➕
                  </button>
                  <button
                    onClick={() => handleDeleteRow(row.id)}
                    className="delete-row-btn"
                    disabled={saving}
                    title="Delete row"
                  >
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Actions */}
      <div className="file-editor-footer">
        <div className="file-editor-actions">
          <button
            onClick={handleSave}
            disabled={saving || !validation.isValid || !hasChanges}
            className="save-btn"
          >
            {saving ? '💾 Saving...' : '💾 Save Changes'}
          </button>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="cancel-btn"
          >
            ❌ Cancel
          </button>
        </div>
        <div className="file-editor-status">
          {hasChanges && <span className="changes-indicator">⚠️ Unsaved changes</span>}
          {saving && <span className="saving-indicator">💾 Saving...</span>}
        </div>
      </div>
    </div>
  );
};

export default FileEditor;
