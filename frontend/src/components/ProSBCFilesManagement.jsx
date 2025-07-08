/**
 * ProSBC Files Management Component
 * Component for viewing, importing, and managing ProSBC files
 */

import React, { useState, useEffect } from 'react';
import { 
  Card, Button, Table, Spin, Input, Select, 
  Tag, Modal, message, Space, Tooltip, Pagination,
  Tabs, Statistic, Row, Col, Alert, Divider
} from 'antd';
import { 
  ReloadOutlined, DownloadOutlined, ImportOutlined, 
  SearchOutlined, FilterOutlined, FileTextOutlined,
  CheckCircleOutlined, SyncOutlined, ExclamationCircleOutlined 
} from '@ant-design/icons';
import { dashboardService } from '../services/apiClient';
import './ProSBCFilesManagement.css'; // You'll create this file for styling

const { TabPane } = Tabs;
const { Option } = Select;
const { confirm } = Modal;

const ProSBCFilesManagement = () => {
  // State
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    search: '',
    fileType: undefined,
    sort: '-uploaded_at'
  });
  const [fileStats, setFileStats] = useState({
    digit_maps: [],
    dial_formats: []
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fetchedFiles, setFetchedFiles] = useState([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  
  // Load files on component mount and when filters change
  useEffect(() => {
    loadFiles();
    loadFileStats();
  }, [filters, pagination.current, pagination.pageSize]);

  // Load files from database
  const loadFiles = async () => {
    try {
      setLoading(true);
      const response = await dashboardService.getProSBCFiles({
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search || undefined,
        fileType: filters.fileType,
        sort: filters.sort
      });
      
      if (response.success) {
        setFiles(response.data);
        setPagination({
          ...pagination,
          total: response.pagination.total
        });
      } else {
        message.error('Failed to load ProSBC files');
      }
    } catch (error) {
      console.error('Error loading ProSBC files:', error);
      message.error('Failed to load ProSBC files: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Load file statistics
  const loadFileStats = async () => {
    try {
      const response = await dashboardService.getProSBCFileStats();
      if (response.success) {
        setFileStats(response.data);
      }
    } catch (error) {
      console.error('Error loading file stats:', error);
    }
  };

  // Fetch files from ProSBC
  const fetchFilesFromProSBC = async () => {
    try {
      setFetching(true);
      const fileService = await import('../services/apiClient').then(m => m.fileService);
      
      const response = await fileService.fetchProSBCFiles({
        fileType: 'all'
      });
      
      if (response && Array.isArray(response)) {
        setFetchedFiles(response);
        setImportModalVisible(true);
        message.success(`Found ${response.length} files in ProSBC`);
      } else {
        message.error('Failed to fetch files from ProSBC');
      }
    } catch (error) {
      console.error('Error fetching ProSBC files:', error);
      message.error('Failed to fetch files from ProSBC: ' + error.message);
    } finally {
      setFetching(false);
    }
  };

  // Import selected files
  const importSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      message.warning('Please select files to import');
      return;
    }
    
    try {
      setImporting(true);
      const fileService = await import('../services/apiClient').then(m => m.fileService);
      
      const filesToImport = fetchedFiles.filter(file => 
        selectedFiles.includes(file.filename)
      );
      
      const response = await fileService.importProSBCFiles(filesToImport);
      
      if (response.success) {
        message.success(`Successfully imported ${response.results.imported} files, updated ${response.results.updated} files`);
        setImportModalVisible(false);
        setSelectedFiles([]);
        loadFiles();
        loadFileStats();
      } else {
        message.error('Failed to import files: ' + response.message);
      }
    } catch (error) {
      console.error('Error importing files:', error);
      message.error('Failed to import files: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  // Download file
  const downloadFile = async (file) => {
    try {
      const response = await dashboardService.downloadProSBCFile(file._id, file.fileType);
      
      // Create download link
      const url = window.URL.createObjectURL(response.blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', response.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      message.success(`Downloading ${response.filename}`);
    } catch (error) {
      console.error('Error downloading file:', error);
      message.error('Failed to download file: ' + error.message);
    }
  };

  // Handle pagination change
  const handlePageChange = (page, pageSize) => {
    setPagination({
      ...pagination,
      current: page,
      pageSize: pageSize
    });
  };

  // Handle search
  const handleSearch = (value) => {
    setFilters({
      ...filters,
      search: value
    });
    setPagination({
      ...pagination,
      current: 1
    });
  };

  // Handle file type filter change
  const handleFileTypeChange = (value) => {
    setFilters({
      ...filters,
      fileType: value
    });
    setPagination({
      ...pagination,
      current: 1
    });
  };

  // Handle sort change
  const handleSortChange = (value) => {
    setFilters({
      ...filters,
      sort: value
    });
  };

  // Handle file selection in import modal
  const handleFileSelect = (filename) => {
    setSelectedFiles(prev => {
      if (prev.includes(filename)) {
        return prev.filter(f => f !== filename);
      } else {
        return [...prev, filename];
      }
    });
  };

  // Handle select all files
  const handleSelectAllFiles = (checked) => {
    if (checked) {
      setSelectedFiles(fetchedFiles.map(file => file.filename));
    } else {
      setSelectedFiles([]);
    }
  };

  // Columns for ProSBC files table
  const columns = [
    {
      title: 'Filename',
      dataIndex: 'original_filename',
      key: 'filename',
      render: (text, record) => (
        <span>
          <FileTextOutlined style={{ marginRight: 8 }} />
          {text || record.filename}
        </span>
      )
    },
    {
      title: 'Type',
      dataIndex: 'fileType',
      key: 'fileType',
      render: (text) => (
        <Tag color={text === 'dm' ? 'blue' : 'green'}>
          {text === 'dm' ? 'Digit Map' : 'Dial Format'}
        </Tag>
      )
    },
    {
      title: 'Size',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size) => `${(size / 1024).toFixed(2)} KB`
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        let color = 'default';
        let icon = null;
        
        if (status === 'validated') {
          color = 'success';
          icon = <CheckCircleOutlined />;
        } else if (status === 'processing') {
          color = 'processing';
          icon = <SyncOutlined spin />;
        } else if (status === 'error') {
          color = 'error';
          icon = <ExclamationCircleOutlined />;
        }
        
        return (
          <Tag color={color} icon={icon}>
            {status}
          </Tag>
        );
      }
    },
    {
      title: 'Imported On',
      dataIndex: 'uploaded_at',
      key: 'uploaded_at',
      render: (date) => new Date(date).toLocaleString()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (text, record) => (
        <Space>
          <Tooltip title="Download">
            <Button 
              type="primary" 
              size="small" 
              icon={<DownloadOutlined />} 
              onClick={() => downloadFile(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // Columns for import modal table
  const importColumns = [
    {
      title: 'Select',
      dataIndex: 'filename',
      key: 'select',
      render: (filename) => (
        <input
          type="checkbox"
          checked={selectedFiles.includes(filename)}
          onChange={() => handleFileSelect(filename)}
        />
      )
    },
    {
      title: 'Filename',
      dataIndex: 'filename',
      key: 'filename'
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type) => (
        <Tag color={type === 'dm' ? 'blue' : 'green'}>
          {type === 'dm' ? 'Digit Map' : 'Dial Format'}
        </Tag>
      )
    },
    {
      title: 'Routeset',
      dataIndex: 'routeset_id',
      key: 'routeset_id'
    },
    {
      title: 'Last Modified',
      dataIndex: 'last_modified',
      key: 'last_modified',
      render: (date) => new Date(date).toLocaleString()
    }
  ];

  // Calculate stats from file_stats
  const dmStats = {
    total: fileStats.digit_maps?.reduce((sum, stat) => sum + stat.count, 0) || 0,
    size: fileStats.digit_maps?.reduce((sum, stat) => sum + stat.total_size, 0) || 0
  };
  
  const dfStats = {
    total: fileStats.dial_formats?.reduce((sum, stat) => sum + stat.count, 0) || 0,
    size: fileStats.dial_formats?.reduce((sum, stat) => sum + stat.total_size, 0) || 0
  };

  return (
    <div className="prosbc-files-management">
      <Card 
        title="ProSBC Files Management" 
        extra={
          <Button 
            type="primary" 
            icon={<ImportOutlined />} 
            onClick={fetchFilesFromProSBC}
            loading={fetching}
          >
            Fetch from ProSBC
          </Button>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic 
              title="Digit Maps" 
              value={dmStats.total} 
              suffix={`files (${(dmStats.size / 1024).toFixed(2)} KB)`}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="Dial Formats" 
              value={dfStats.total} 
              suffix={`files (${(dfStats.size / 1024).toFixed(2)} KB)`}
            />
          </Col>
          <Col span={12}>
            <Alert 
              type="info" 
              message="Files from ProSBC are stored locally for faster access and offline availability."
              showIcon
            />
          </Col>
        </Row>
        
        <Divider />
        
        <div className="table-toolbar">
          <Space>
            <Input.Search
              placeholder="Search files"
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={handleSearch}
              style={{ width: 250 }}
            />
            <Select 
              placeholder="File Type"
              allowClear
              style={{ width: 150 }}
              onChange={handleFileTypeChange}
            >
              <Option value="dm">Digit Maps</Option>
              <Option value="df">Dial Formats</Option>
            </Select>
            <Select
              placeholder="Sort By"
              defaultValue="-uploaded_at"
              style={{ width: 180 }}
              onChange={handleSortChange}
            >
              <Option value="-uploaded_at">Newest First</Option>
              <Option value="uploaded_at">Oldest First</Option>
              <Option value="-file_size">Largest Size</Option>
              <Option value="filename">Filename A-Z</Option>
            </Select>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadFiles}
            >
              Refresh
            </Button>
          </Space>
        </div>
        
        <Table
          columns={columns}
          dataSource={files}
          rowKey="_id"
          loading={loading}
          pagination={false}
          style={{ marginTop: 16 }}
        />
        
        <Pagination 
          current={pagination.current}
          pageSize={pagination.pageSize}
          total={pagination.total}
          showSizeChanger
          showQuickJumper
          showTotal={(total) => `Total ${total} items`}
          onChange={handlePageChange}
          onShowSizeChange={handlePageChange}
          style={{ marginTop: 16, textAlign: 'right' }}
        />
      </Card>
      
      {/* Import Modal */}
      <Modal
        title="Import ProSBC Files"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setImportModalVisible(false)}>
            Cancel
          </Button>,
          <Button 
            key="import" 
            type="primary" 
            loading={importing}
            onClick={importSelectedFiles}
          >
            Import Selected ({selectedFiles.length})
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="Select files to import from ProSBC"
            description="Files that already exist will be updated if the content has changed."
            type="info"
            showIcon
          />
        </div>
        
        <div style={{ marginBottom: 8 }}>
          <label>
            <input
              type="checkbox"
              checked={selectedFiles.length === fetchedFiles.length && fetchedFiles.length > 0}
              onChange={(e) => handleSelectAllFiles(e.target.checked)}
            />
            {' '} Select All ({fetchedFiles.length} files)
          </label>
        </div>
        
        <Table
          columns={importColumns}
          dataSource={fetchedFiles}
          rowKey="filename"
          pagination={{
            pageSize: 5,
            hideOnSinglePage: true
          }}
          size="small"
        />
      </Modal>
    </div>
  );
};

export default ProSBCFilesManagement;
