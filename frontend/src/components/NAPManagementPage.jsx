import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const NAPManagementPage = () => {
  const [naps, setNaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedNAP, setSelectedNAP] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({});

  useEffect(() => {
    fetchNAPs();
    fetchStats();
  }, [currentPage, statusFilter, searchTerm]);

  const fetchNAPs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
        sort: '-created_at'
      });
      
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const response = await fetch(`${API_BASE}/naps?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setNaps(data.data);
        setTotalPages(data.pagination.pages);
      } else {
        setError(data.error || 'Failed to fetch NAPs');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('NAPs fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/naps/stats`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  };

  const handleDeleteNAP = async (napId) => {
    if (!confirm('Are you sure you want to delete this NAP?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/naps/${napId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deleted_by: 'admin' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        fetchNAPs();
        fetchStats();
      } else {
        alert(data.error || 'Failed to delete NAP');
      }
    } catch (err) {
      alert('Failed to delete NAP');
      console.error('Delete error:', err);
    }
  };

  const handleValidateNAP = async (napId) => {
    try {
      const response = await fetch(`${API_BASE}/naps/${napId}/validate`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Validation ${data.data.is_valid ? 'passed' : 'failed'}: ${data.message}`);
        fetchNAPs();
      } else {
        alert(data.error || 'Validation failed');
      }
    } catch (err) {
      alert('Failed to validate NAP');
      console.error('Validation error:', err);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'created':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'mapped':
        return <MapPin className="w-4 h-4 text-purple-500" />;
      case 'activated':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'inactive':
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
      default:
        return <Server className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'created':
        return 'bg-blue-100 text-blue-800';
      case 'mapped':
        return 'bg-purple-100 text-purple-800';
      case 'activated':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredNAPs = naps.filter(nap => {
    const matchesSearch = searchTerm === '' || 
      nap.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (nap.description && nap.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || nap.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">NAP Management</h1>
          <p className="text-gray-600">Manage Network Access Points</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button 
            onClick={fetchNAPs}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create NAP
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total || 0}</div>
            <div className="text-sm text-gray-600">Total NAPs</div>
          </CardContent>
        </Card>
        
        {stats.by_status && Object.entries(stats.by_status).map(([status, count]) => (
          <Card key={status}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-gray-600 capitalize">{status}</div>
                </div>
                {getStatusIcon(status)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search NAPs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="created">Created</option>
                <option value="mapped">Mapped</option>
                <option value="activated">Activated</option>
                <option value="error">Error</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NAPs Table */}
      <Card>
        <CardHeader>
          <CardTitle>NAPs ({filteredNAPs.length})</CardTitle>
          <CardDescription>
            Network Access Points in your system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{error}</p>
              <Button 
                onClick={fetchNAPs} 
                className="mt-4"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : filteredNAPs.length === 0 ? (
            <div className="text-center py-8">
              <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No NAPs found</p>
              <Button 
                onClick={() => setShowCreateModal(true)}
                className="mt-4"
              >
                Create First NAP
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Created</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Validation</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNAPs.map((nap) => (
                    <tr key={nap._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{nap.name}</div>
                          {nap.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {nap.description}
                            </div>
                          )}
                          {nap.tags && nap.tags.length > 0 && (
                            <div className="flex space-x-1 mt-1">
                              {nap.tags.slice(0, 2).map((tag, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {nap.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{nap.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(nap.status)}
                          <Badge className={getStatusColor(nap.status)}>
                            {nap.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-gray-900">
                          {formatDate(nap.created_at)}
                        </div>
                        <div className="text-xs text-gray-500">
                          by {nap.created_by}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {nap.validation_results?.is_valid ? (
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-600">Valid</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-red-600">
                              {nap.validation_results?.errors?.length || 0} errors
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            onClick={() => {
                              setSelectedNAP(nap);
                              setShowViewModal(true);
                            }}
                            variant="ghost"
                            size="sm"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleValidateNAP(nap._id)}
                            variant="ghost"
                            size="sm"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteNAP(nap._id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            variant="outline"
          >
            Previous
          </Button>
          <span className="flex items-center px-4 py-2 text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}

      {/* View NAP Modal */}
      {showViewModal && selectedNAP && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">NAP Details: {selectedNAP.name}</h2>
                <Button
                  onClick={() => setShowViewModal(false)}
                  variant="ghost"
                  size="sm"
                >
                  ×
                </Button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <div className="mt-1 flex items-center space-x-2">
                      {getStatusIcon(selectedNAP.status)}
                      <Badge className={getStatusColor(selectedNAP.status)}>
                        {selectedNAP.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Created</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {formatDate(selectedNAP.created_at)}
                    </div>
                  </div>
                </div>

                {selectedNAP.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Description</label>
                    <div className="mt-1 text-sm text-gray-900">
                      {selectedNAP.description}
                    </div>
                  </div>
                )}

                {selectedNAP.tags && selectedNAP.tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tags</label>
                    <div className="mt-1 flex space-x-2">
                      {selectedNAP.tags.map((tag, index) => (
                        <Badge key={index} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700">Configuration JSON</label>
                  <pre className="mt-1 bg-gray-100 p-4 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedNAP.config_data, null, 2)}
                  </pre>
                </div>

                {selectedNAP.validation_results && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Validation Results</label>
                    <div className="mt-1 space-y-2">
                      <div className="flex items-center space-x-2">
                        {selectedNAP.validation_results.is_valid ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-sm text-green-600">Valid</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="text-sm text-red-600">Invalid</span>
                          </>
                        )}
                      </div>
                      
                      {selectedNAP.validation_results.errors?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-red-700">Errors:</h4>
                          <ul className="list-disc list-inside text-sm text-red-600">
                            {selectedNAP.validation_results.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {selectedNAP.validation_results.warnings?.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-yellow-700">Warnings:</h4>
                          <ul className="list-disc list-inside text-sm text-yellow-600">
                            {selectedNAP.validation_results.warnings.map((warning, index) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NAPManagementPage;
