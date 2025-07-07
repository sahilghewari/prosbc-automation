import React, { useState, useEffect } from 'react';
import NapEditService from '../utils/napEditService';

const EditNapModal = ({ isOpen = false, onClose, napId, baseUrl = '/api', sessionCookie = '', onSuccess, onAuthError }) => {
  console.log('EditNapModal rendered with props:', { isOpen, napId, baseUrl, sessionCookieExists: !!sessionCookie });
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');

  const napEditService = new NapEditService(baseUrl, sessionCookie);

  useEffect(() => {
    console.log('NapEditor useEffect triggered:', { isOpen, napId, baseUrl });
    if (isOpen && napId) {
      loadNapData();
    }
  }, [isOpen, napId]);

  const loadNapData = async () => {
    console.log('Loading NAP data for ID:', napId);
    console.log('Base URL:', baseUrl);
    console.log('Session Cookie available:', !!sessionCookie);
    
    setLoading(true);
    setError(null);
    try {
      const data = await napEditService.getNapForEdit(napId);
      console.log('NAP data loaded successfully:', data);
      setFormData(data);
    } catch (err) {
      console.error('Error loading NAP data:', err);
      setError('Failed to load NAP data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await napEditService.updateNap(napId, formData);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError('Failed to update NAP');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800">
          <h2 className="text-2xl font-bold text-white">Edit NAP Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-300">Loading NAP data...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 px-4 py-3 rounded-md m-6">
            {error}
          </div>
        )}

        {formData && (
          <>
            {/* Tab Navigation */}
            <div className="border-b border-gray-700 bg-gray-800/50">
              <nav className="flex space-x-8 px-6 overflow-x-auto">
                {[
                  { id: 'basic', label: 'Basic Settings' },
                  { id: 'sip', label: 'SIP Configuration' },
                  { id: 'authentication', label: 'Authentication' },
                  { id: 'nat', label: 'NAT Settings' },
                  { id: 'sipi', label: 'SIP-I Parameters' },
                  { id: 'advanced', label: 'Advanced' },
                  { id: 'ratelimit', label: 'Rate Limiting' },
                  { id: 'sipservers', label: 'SIP Servers' },
                  { id: 'portranges', label: 'Port Ranges' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[60vh]" style={{scrollbarColor: '#4A5568 #1A202C', scrollbarWidth: 'thin'}}>
              <div className="p-6 space-y-6 bg-gray-800">
                {/* Basic Settings Tab */}
                {activeTab === 'basic' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200">Basic Settings</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          NAP Name
                        </label>
                        <input
                          type="text"
                          value={formData.name || ''}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Default Profile
                        </label>
                        <select
                          value={formData.profileId || '1'}
                          onChange={(e) => handleInputChange('profileId', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        >
                          <option value="1">default</option>
                          <option value="2">asterisk</option>
                          <option value="3">freeswitch</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* SIP Configuration Tab */}
                {activeTab === 'sip' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200">SIP Configuration</h3>
                    
                    <div className="flex items-center mb-4">
                      <input
                        type="checkbox"
                        id="sipUseProxy"
                        checked={formData.sipUseProxy || false}
                        onChange={(e) => handleInputChange('sipUseProxy', e.target.checked)}
                        className="h-4 w-4 text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600 rounded"
                      />
                      <label htmlFor="sipUseProxy" className="ml-2 text-sm text-gray-300">
                        Use Proxy Address
                      </label>
                    </div>

                    {formData.sipUseProxy && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Proxy Address
                          </label>
                          <input
                            type="text"
                            value={formData.proxyAddress || ''}
                            onChange={(e) => handleInputChange('proxyAddress', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                            placeholder="IP address or domain name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Proxy Port
                          </label>
                          <input
                            type="number"
                            value={formData.proxyPort || '5060'}
                            onChange={(e) => handleInputChange('proxyPort', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="filterByProxyPort"
                          checked={formData.filterByProxyPort || false}
                          onChange={(e) => handleInputChange('filterByProxyPort', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="filterByProxyPort" className="ml-2 text-sm text-gray-300">
                          Filter by proxy port
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="pollRemoteProxy"
                          checked={formData.pollRemoteProxy || false}
                          onChange={(e) => handleInputChange('pollRemoteProxy', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="pollRemoteProxy" className="ml-2 text-sm text-gray-300">
                          Poll Remote Proxy
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="acceptOnlyAuthorizedUsers"
                          checked={formData.acceptOnlyAuthorizedUsers || false}
                          onChange={(e) => handleInputChange('acceptOnlyAuthorizedUsers', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="acceptOnlyAuthorizedUsers" className="ml-2 text-sm text-gray-300">
                          Accept only authorized users
                        </label>
                      </div>
                    </div>

                    {formData.pollRemoteProxy && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Polling Interval
                          </label>
                          <input
                            type="number"
                            value={formData.proxyPollingInterval || '1'}
                            onChange={(e) => handleInputChange('proxyPollingInterval', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Unit
                          </label>
                          <select
                            value={formData.proxyPollingIntervalUnit || 'minutes'}
                            onChange={(e) => handleInputChange('proxyPollingIntervalUnit', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          >
                            <option value="milliseconds">milliseconds</option>
                            <option value="seconds">seconds</option>
                            <option value="minutes">minutes</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Authentication Tab */}
                {activeTab === 'authentication' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200">Authentication Parameters</h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="registerToProxy"
                          checked={formData.registerToProxy || false}
                          onChange={(e) => handleInputChange('registerToProxy', e.target.checked)}
                          className="h-4 w-4 text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600 rounded"
                        />
                        <label htmlFor="registerToProxy" className="ml-2 text-sm text-gray-300">
                          Register to Proxy
                        </label>
                      </div>

                      {formData.registerToProxy && (
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Address to Register
                          </label>
                          <input
                            type="text"
                            value={formData.addressToRegister || ''}
                            onChange={(e) => handleInputChange('addressToRegister', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                            placeholder="sip:username@hostname"
                          />
                        </div>
                      )}

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="ignoreRealm"
                          checked={formData.ignoreRealm || false}
                          onChange={(e) => handleInputChange('ignoreRealm', e.target.checked)}
                          className="h-4 w-4 text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600 rounded"
                        />
                        <label htmlFor="ignoreRealm" className="ml-2 text-sm text-gray-300">
                          Ignore realm
                        </label>
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="reuseChallenge"
                          checked={formData.reuseChallenge || false}
                          onChange={(e) => handleInputChange('reuseChallenge', e.target.checked)}
                          className="h-4 w-4 text-blue-500 focus:ring-blue-500 bg-gray-700 border-gray-600 rounded"
                        />
                        <label htmlFor="reuseChallenge" className="ml-2 text-sm text-gray-300">
                          Reuse challenge
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Realm
                        </label>
                        <input
                          type="text"
                          value={formData.realm || ''}
                          onChange={(e) => handleInputChange('realm', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          User
                        </label>
                        <input
                          type="text"
                          value={formData.authUser || ''}
                          onChange={(e) => handleInputChange('authUser', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Password
                        </label>
                        <input
                          type="password"
                          value={formData.authPassword || ''}
                          onChange={(e) => handleInputChange('authPassword', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* NAT Settings Tab */}
                {activeTab === 'nat' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200">NAT Settings</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1">
                          Remote Method (RTP)
                        </label>
                        <select
                          value={formData.remoteMethodRtp || 'None'}
                          onChange={(e) => handleInputChange('remoteMethodRtp', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="None">None</option>
                          <option value="Force Passive Mode">Force Passive Mode</option>
                          <option value="Parse Direction Attribute">Parse Direction Attribute</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1">
                          Remote Method (SIP)
                        </label>
                        <select
                          value={formData.remoteMethodSip || 'None'}
                          onChange={(e) => handleInputChange('remoteMethodSip', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="None">None</option>
                          <option value="Automatic NAT traversal">Automatic NAT traversal</option>
                          <option value="Force Use of Public IP/Port or FQDN">Force Use of Public IP/Port or FQDN</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1">
                          Local Method (RTP)
                        </label>
                        <input
                          type="text"
                          value={formData.localMethodRtp || ''}
                          onChange={(e) => handleInputChange('localMethodRtp', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1">
                          Local Method (SIP)
                        </label>
                        <input
                          type="text"
                          value={formData.localMethodSip || ''}
                          onChange={(e) => handleInputChange('localMethodSip', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* SIP-I Parameters Tab */}
                {activeTab === 'sipi' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-100">SIP-I Parameters</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="sipiEnable"
                          checked={formData.sipiEnable || false}
                          onChange={(e) => handleInputChange('sipiEnable', e.target.checked)}
                          className="mr-2"
                        />
                        <label htmlFor="sipiEnable" className="text-sm font-medium text-gray-200">
                          Enable SIP-I
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">
                            ISUP Protocol Variant
                          </label>
                          <select
                            value={formData.isupProtocolVariant || 'ITU'}
                            onChange={(e) => handleInputChange('isupProtocolVariant', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="ANSI88">ANSI88</option>
                            <option value="ANSI92">ANSI92</option>
                            <option value="ANSI95">ANSI95</option>
                            <option value="TELCORDIA">TELCORDIA</option>
                            <option value="ITU">ITU</option>
                            <option value="ITU97">ITU97</option>
                            <option value="SINGAPORE">SINGAPORE</option>
                            <option value="Q767">Q767</option>
                            <option value="NTT">NTT</option>
                            <option value="CHINA">CHINA</option>
                            <option value="ETSI">ETSI</option>
                            <option value="ETSIV3">ETSIV3</option>
                            <option value="UK">UK</option>
                            <option value="SPIROU">SPIROU</option>
                            <option value="RUSSIA">RUSSIA</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">
                            Content Type
                          </label>
                          <input
                            type="text"
                            value={formData.contentType || 'itu-t'}
                            onChange={(e) => handleInputChange('contentType', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">
                            Call Progress Method
                          </label>
                          <select
                            value={formData.callProgressMethod || '183 Call Progress'}
                            onChange={(e) => handleInputChange('callProgressMethod', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="183 Call Progress">183 Call Progress</option>
                            <option value="SIP_INFO">SIP_INFO</option>
                          </select>
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="appendFToOutgoingCalls"
                            checked={formData.appendFToOutgoingCalls || false}
                            onChange={(e) => handleInputChange('appendFToOutgoingCalls', e.target.checked)}
                            className="mr-2"
                          />
                          <label htmlFor="appendFToOutgoingCalls" className="text-sm font-medium text-gray-200">
                            Append F to Outgoing Calls
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Advanced Tab */}
                {activeTab === 'advanced' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200">Advanced Parameters</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="mapAnyResponseToAvailableStatus"
                          checked={formData.mapAnyResponseToAvailableStatus || false}
                          onChange={(e) => handleInputChange('mapAnyResponseToAvailableStatus', e.target.checked)}
                          className="mr-2"
                        />
                        <label htmlFor="mapAnyResponseToAvailableStatus" className="text-sm font-medium text-gray-200">
                          Map any response to available status
                        </label>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">
                            Response Timeout
                          </label>
                          <div className="flex space-x-2">
                            <input
                              type="number"
                              value={formData.responseTimeout || '12'}
                              onChange={(e) => handleInputChange('responseTimeout', e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <select
                              value={formData.responseTimeoutUnit || 'seconds'}
                              onChange={(e) => handleInputChange('responseTimeoutUnit', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="seconds">seconds</option>
                              <option value="minutes">minutes</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-200 mb-1">
                            Max Forwards (Proxy Polling)
                          </label>
                          <input
                            type="number"
                            value={formData.proxyPollingMaxForwards || '1'}
                            onChange={(e) => handleInputChange('proxyPollingMaxForwards', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="triggersCallProgress"
                            checked={formData.triggersCallProgress || false}
                            onChange={(e) => handleInputChange('triggersCallProgress', e.target.checked)}
                            className="mr-2"
                          />
                          <label htmlFor="triggersCallProgress" className="text-sm font-medium text-gray-200">
                            183 triggers call progress
                          </label>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-1">
                            Privacy Type
                          </label>
                          <select
                            value={formData.privacyType || 'P-Asserted-Identity'}
                            onChange={(e) => handleInputChange('privacyType', e.target.value)}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          >
                            <option value="None">None</option>
                            <option value="Remote-Party-Id">Remote-Party-Id</option>
                            <option value="P-Asserted-Identity">P-Asserted-Identity</option>
                            <option value="Both">Both</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rate Limiting Tab */}
                {activeTab === 'ratelimit' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200">Rate Limiting</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Max Calls Per Second
                        </label>
                        <input
                          type="number"
                          value={formData.maxCallsPerSecond || '0'}
                          onChange={(e) => handleInputChange('maxCallsPerSecond', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Max Incoming Calls Per Second
                        </label>
                        <input
                          type="number"
                          value={formData.maxIncomingCallsPerSecond || '0'}
                          onChange={(e) => handleInputChange('maxIncomingCallsPerSecond', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Max Outgoing Calls Per Second
                        </label>
                        <input
                          type="number"
                          value={formData.maxOutgoingCallsPerSecond || '0'}
                          onChange={(e) => handleInputChange('maxOutgoingCallsPerSecond', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Max Simultaneous Incoming Calls
                        </label>
                        <input
                          type="number"
                          value={formData.maxSimultaneousIncomingCalls || '0'}
                          onChange={(e) => handleInputChange('maxSimultaneousIncomingCalls', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Max Simultaneous Outgoing Calls
                        </label>
                        <input
                          type="number"
                          value={formData.maxSimultaneousOutgoingCalls || '0'}
                          onChange={(e) => handleInputChange('maxSimultaneousOutgoingCalls', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Max Simultaneous Total Calls
                        </label>
                        <input
                          type="number"
                          value={formData.maxSimultaneousTotalCalls || '0'}
                          onChange={(e) => handleInputChange('maxSimultaneousTotalCalls', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Processing Delay Low Threshold
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            value={formData.processingDelayLowThreshold || '3'}
                            onChange={(e) => handleInputChange('processingDelayLowThreshold', e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          />
                          <select
                            value={formData.processingDelayLowUnit || 'seconds'}
                            onChange={(e) => handleInputChange('processingDelayLowUnit', e.target.value)}
                            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          >
                            <option value="seconds">seconds</option>
                            <option value="minutes">minutes</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Processing Delay High Threshold
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            value={formData.processingDelayHighThreshold || '6'}
                            onChange={(e) => handleInputChange('processingDelayHighThreshold', e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          />
                          <select
                            value={formData.processingDelayHighUnit || 'seconds'}
                            onChange={(e) => handleInputChange('processingDelayHighUnit', e.target.value)}
                            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          >
                            <option value="seconds">seconds</option>
                            <option value="minutes">minutes</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Nb Calls Per Period
                        </label>
                        <input
                          type="number"
                          value={formData.nbCallsPerPeriod || '1'}
                          onChange={(e) => handleInputChange('nbCallsPerPeriod', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Period Duration
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            value={formData.periodDuration || '1'}
                            onChange={(e) => handleInputChange('periodDuration', e.target.value)}
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          />
                          <select
                            value={formData.periodDurationUnit || 'seconds'}
                            onChange={(e) => handleInputChange('periodDurationUnit', e.target.value)}
                            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                          >
                            <option value="seconds">seconds</option>
                            <option value="minutes">minutes</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SIP Transport Servers Tab */}
                {activeTab === 'sipservers' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200">SIP Transport Servers</h3>
                    
                    <div className="space-y-6">
                      {/* Current SIP Servers */}
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-gray-300">Current Servers</h4>
                        <div className="border border-gray-600 rounded-lg min-h-[100px] p-4 bg-gray-700/50">
                          {!formData.selectedSipServers || formData.selectedSipServers.length === 0 ? (
                            <p className="text-gray-400 text-center py-4">No SIP servers selected</p>
                          ) : (
                            <div className="space-y-2">
                              {formData.selectedSipServers.map((server) => (
                                <div key={server.id} className="flex items-center justify-between bg-gray-800 p-3 rounded-lg border border-gray-600">
                                  <span className="font-medium text-gray-200">{server.name}</span>
                                  <button
                                    onClick={() => {
                                      const updatedServers = formData.selectedSipServers.filter(s => s.id !== server.id);
                                      handleInputChange('selectedSipServers', updatedServers);
                                    }}
                                    className="text-red-400 hover:text-red-300 font-medium text-sm"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Available SIP Servers */}
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-gray-300">Available Servers</h4>
                        <div className="flex space-x-4">
                          <select
                            multiple
                            size="5"
                            className="flex-1 border-2 border-gray-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-400 p-3 bg-gray-700 text-gray-200"
                            value={[]}
                            onChange={(e) => {
                              const selectedOptions = Array.from(e.target.selectedOptions);
                              selectedOptions.forEach(option => {
                                const server = formData.availableSipServers?.find(s => s.id === option.value);
                                if (server && !formData.selectedSipServers?.find(s => s.id === server.id)) {
                                  const updatedServers = [...(formData.selectedSipServers || []), server];
                                  handleInputChange('selectedSipServers', updatedServers);
                                }
                              });
                            }}
                          >
                            {formData.availableSipServers
                              ?.filter(server => !formData.selectedSipServers?.find(s => s.id === server.id))
                              .map((server) => (
                                <option key={server.id} value={server.id}>
                                  {server.name}
                                </option>
                              ))}
                          </select>
                          <div className="flex items-center">
                            <button
                              type="button"
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              ←
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-blue-900/30 border border-blue-700 p-4 rounded-lg">
                        <p className="text-sm text-blue-300">
                          <strong>Note:</strong> You can add/remove SIP transport servers using the interface above. 
                          Changes will be saved when you submit the form.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Port Ranges Tab */}
                {activeTab === 'portranges' && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-200">VOIP Media Port Ranges</h3>
                    
                    <div className="space-y-6">
                      {/* Current Port Ranges */}
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-gray-300">Current Port Ranges</h4>
                        <div className="border border-gray-600 rounded-lg min-h-[100px] p-4 bg-gray-700/50">
                          {!formData.selectedPortRanges || formData.selectedPortRanges.length === 0 ? (
                            <p className="text-gray-400 text-center py-4">No port ranges selected</p>
                          ) : (
                            <div className="space-y-2">
                              {formData.selectedPortRanges.map((range) => (
                                <div key={range.id} className="flex items-center justify-between bg-gray-800 p-3 rounded-lg border border-gray-600">
                                  <span className="font-medium text-gray-200">{range.name}</span>
                                  <button
                                    onClick={() => {
                                      const updatedRanges = formData.selectedPortRanges.filter(r => r.id !== range.id);
                                      handleInputChange('selectedPortRanges', updatedRanges);
                                    }}
                                    className="text-red-400 hover:text-red-300 font-medium text-sm"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Available Port Ranges */}
                      <div className="space-y-3">
                        <h4 className="text-md font-semibold text-gray-300">Available Port Ranges</h4>
                        <div className="flex space-x-4">
                          <select
                            multiple
                            size="5"
                            className="flex-1 border-2 border-gray-600 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-400 p-3 bg-gray-700 text-gray-200"
                            value={[]}
                            onChange={(e) => {
                              const selectedOptions = Array.from(e.target.selectedOptions);
                              selectedOptions.forEach(option => {
                                const range = formData.availablePortRanges?.find(r => r.id === option.value);
                                if (range && !formData.selectedPortRanges?.find(r => r.id === range.id)) {
                                  const updatedRanges = [...(formData.selectedPortRanges || []), range];
                                  handleInputChange('selectedPortRanges', updatedRanges);
                                }
                              });
                            }}
                          >
                            {formData.availablePortRanges
                              ?.filter(range => !formData.selectedPortRanges?.find(r => r.id === range.id))
                              .map((range) => (
                                <option key={range.id} value={range.id}>
                                  {range.name}
                                </option>
                              ))}
                          </select>
                          <div className="flex items-center">
                            <button
                              type="button"
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              ←
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-blue-900/30 border border-blue-700 p-4 rounded-lg">
                        <p className="text-sm text-blue-300">
                          <strong>Note:</strong> You can add/remove port ranges using the interface above. 
                          Changes will be saved when you submit the form.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="border-t border-gray-600 px-6 py-4 bg-gray-700 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-md font-medium transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>

            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default EditNapModal;