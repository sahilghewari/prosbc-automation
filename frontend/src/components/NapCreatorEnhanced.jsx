import React, { useState, useEffect } from 'react';
import { 
  createNapWithProSBCWorkflow as createNapAPI, 
  checkNapExists, 
  clearSessionCache,
  debugNapExistence
} from '../utils/napApiProSBCWorkflowOptimized';
import { validateNapConfig } from '../utils/napApiProSBCWorkflow';
import { ClientDatabaseService } from '../services/apiClient.js';
import DatabaseStatus from './DatabaseStatus';
import PerformanceMetrics from './PerformanceMetrics';
import './NapCreatorEnhanced.css';

const NapCreatorEnhanced = ({ onAuthError }) => {
  // Basic NAP Configuration
  const [napName, setNapName] = useState('');
  const [enabled, setEnabled] = useState(true); // Always enabled, not shown in UI
  const [defaultProfile, setDefaultProfile] = useState('1');
  
  // SIP Proxy Configuration
  const [useProxy, setUseProxy] = useState(true);
  const [proxyAddress, setProxyAddress] = useState('');
  const [proxyPort, setProxyPort] = useState('5060');
  const [filterByProxyPort, setFilterByProxyPort] = useState(true);
  const [pollRemoteProxy, setPollRemoteProxy] = useState(true);
  const [proxyPollingInterval, setProxyPollingInterval] = useState('1');
  const [proxyPollingIntervalUnit, setProxyPollingIntervalUnit] = useState('60000.0');
  const [acceptOnlyAuthorizedUsers, setAcceptOnlyAuthorizedUsers] = useState(false);
  
  // Registration Parameters
  const [registerToProxy, setRegisterToProxy] = useState(false);
  const [addressToRegister, setAddressToRegister] = useState('');
  
  // Authentication Parameters
  const [ignoreRealm, setIgnoreRealm] = useState(false);
  const [reuseChallenge, setReuseChallenge] = useState(false);
  const [realm, setRealm] = useState('');
  const [authUser, setAuthUser] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  
  // Network Address Translation (NAT)
  const [remoteNatRtp, setRemoteNatRtp] = useState('0');
  const [remoteNatSip, setRemoteNatSip] = useState('0');
  const [localNatRtp, setLocalNatRtp] = useState('');
  const [localNatSip, setLocalNatSip] = useState('');
  
  // SIP-I Parameters
  const [sipiEnable, setSipiEnable] = useState(false);
  const [isupProtocolVariant, setIsupProtocolVariant] = useState('5');
  const [sipiVersion, setSipiVersion] = useState('itu-t');
  const [sipiUseInfoProgress, setSipiUseInfoProgress] = useState('0');
  const [appendTrailingF, setAppendTrailingF] = useState(false);
  
  // Advanced Parameters
  const [pollProxyPingQuirk, setPollProxyPingQuirk] = useState(true);
  const [responseTimeout, setResponseTimeout] = useState('12');
  const [responseTimeoutUnit, setResponseTimeoutUnit] = useState('1000.0');
  const [maxForwards, setMaxForwards] = useState('1');
  const [sip183CallProgress, setSip183CallProgress] = useState(false);
  const [privacyType, setPrivacyType] = useState('3');
  
  // Call Rate Limiting
  const [rateLimitCps, setRateLimitCps] = useState('0');
  const [rateLimitCpsIn, setRateLimitCpsIn] = useState('0');
  const [rateLimitCpsOut, setRateLimitCpsOut] = useState('0');
  const [maxIncomingCalls, setMaxIncomingCalls] = useState('0');
  const [maxOutgoingCalls, setMaxOutgoingCalls] = useState('0');
  const [maxTotalCalls, setMaxTotalCalls] = useState('0');
  const [delayLowThreshold, setDelayLowThreshold] = useState('3');
  const [delayLowUnit, setDelayLowUnit] = useState('1.0');
  const [delayHighThreshold, setDelayHighThreshold] = useState('6');
  const [delayHighUnit, setDelayHighUnit] = useState('1.0');
  
  // Congestion Threshold
  const [congestionNbCalls, setCongestionNbCalls] = useState('1');
  const [congestionPeriod, setCongestionPeriod] = useState('1');
  const [congestionPeriodUnit, setCongestionPeriodUnit] = useState('1.0');
  
  // SIP Transport Servers and Port Ranges
  const [selectedSipServers, setSelectedSipServers] = useState([]);
  const [selectedPortRanges, setSelectedPortRanges] = useState([]);
  
  // Available options (these would typically come from an API)
  const [availableProfiles] = useState([
    { value: '1', label: 'default' },
    { value: '2', label: 'asterisk' },
    { value: '3', label: 'freeswitch' }
  ]);
  
  const [availableSipServers] = useState([
    { id: '2', name: 'SIP_voip_66_5060' },
    { id: '3', name: 'SIP_voip_67_5060' },
    { id: '5', name: 'SIP_voip_68_5060' },
    { id: '4', name: 'SIP_voip_69_5060' },
    { id: '6', name: 'SIP_voip_70_5060' }
  ]);
  
  const [availablePortRanges] = useState([
    { id: '3', name: 'voip0:Public_66:pr_Public_66:20000-40000' },
    { id: '4', name: 'voip0:Public_67:pr_Public_67:20000-40000' },
    { id: '5', name: 'voip0:Public_68:pr_Public_68:20000-40000' },
    { id: '6', name: 'voip0:Public_69:pr_Public_69:20000-40000' },
    { id: '7', name: 'voip0:Public_70:pr_Public_70:20000-40000' }
  ]);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [showPerformanceMetrics, setShowPerformanceMetrics] = useState(false);
  
  // Section visibility
  const [showRegistrationParams, setShowRegistrationParams] = useState(false);
  const [showAuthParams, setShowAuthParams] = useState(false);
  const [showNatParams, setShowNatParams] = useState(false);
  const [showSipiParams, setShowSipiParams] = useState(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [showCallRateLimit, setShowCallRateLimit] = useState(false);
  const [showCongestionThreshold, setShowCongestionThreshold] = useState(true);
  
  // Show/hide section toggles
  // Enhanced NAP creation function that follows ProSBC workflow
  const createNapWithProSBCWorkflow = async () => {
    if (!napName.trim()) {
      setMessage('❌ Please enter a NAP name');
      return;
    }
    
    setLoading(true);
    setCurrentStep(1);
    const startTime = Date.now();
    
    try {
      // Step 1: Check if NAP already exists (optimized)
      setMessage('Step 1: Checking for duplicate NAP names...');
      console.log(`Checking if NAP "${napName}" already exists...`);
      
      const napExistsResult = await checkNapExists(napName);
      console.log('NAP existence check result:', napExistsResult);
      
      if (napExistsResult.exists) {
        // If we get a false positive, run debug check
        console.log('⚠️ NAP appears to exist, running debug check...');
        const debugResult = await debugNapExistence(napName);
        console.log('Debug result:', debugResult);
        
        setMessage(`❌ Error: A NAP with the name "${napName}" already exists in ProSBC. Please choose a different name.`);
        setLoading(false);
        setCurrentStep(1);
        return;
      }
      
      // Step 2: Build configuration object
      setCurrentStep(2);
      setMessage('Step 2: Building NAP configuration...');
      
      const napConfig = {
        // Basic Configuration
        name: napName,
        enabled: enabled,
        profile_id: defaultProfile,
        
        // SIP Proxy Configuration
        sip_destination_ip: useProxy ? proxyAddress : '',
        sip_destination_port: useProxy ? proxyPort : '5060',
        filter_by_proxy_port: filterByProxyPort,
        poll_remote_proxy: pollRemoteProxy,
        proxy_polling_interval: proxyPollingInterval,
        proxy_polling_interval_unit: proxyPollingIntervalUnit,
        accept_only_authorized_users: acceptOnlyAuthorizedUsers,
        
        // Registration Parameters
        register_to_proxy: registerToProxy,
        aor: addressToRegister,
        
        // Authentication Parameters
        sip_auth_ignore_realm: ignoreRealm,
        sip_auth_reuse_challenge: reuseChallenge,
        sip_auth_realm: realm,
        sip_auth_user: authUser,
        sip_auth_pass: authPassword,
        
        // NAT Parameters
        remote_nat_rtp: remoteNatRtp,
        remote_nat_sip: remoteNatSip,
        local_nat_rtp: localNatRtp,
        local_nat_sip: localNatSip,
        
        // SIP-I Parameters
        sipi_enable: sipiEnable,
        isup_protocol_variant: isupProtocolVariant,
        sipi_version: sipiVersion,
        sipi_use_info_progress: sipiUseInfoProgress,
        append_trailing_f: appendTrailingF,
        
        // Advanced Parameters
        poll_proxy_ping_quirk: pollProxyPingQuirk,
        response_timeout: responseTimeout,
        response_timeout_unit: responseTimeoutUnit,
        max_forwards: maxForwards,
        sip_183_call_progress: sip183CallProgress,
        privacy_type: privacyType,
        
        // Call Rate Limiting
        rate_limit_cps: rateLimitCps,
        rate_limit_cps_in: rateLimitCpsIn,
        rate_limit_cps_out: rateLimitCpsOut,
        max_incoming_calls: maxIncomingCalls,
        max_outgoing_calls: maxOutgoingCalls,
        max_total_calls: maxTotalCalls,
        delay_low_threshold: delayLowThreshold,
        delay_low_unit: delayLowUnit,
        delay_high_threshold: delayHighThreshold,
        delay_high_unit: delayHighUnit,
        
        // Congestion Threshold
        congestion_nb_calls: congestionNbCalls,
        congestion_period: congestionPeriod,
        congestion_period_unit: congestionPeriodUnit,
        
        // SIP Transport Servers and Port Ranges
        sip_servers: selectedSipServers,
        port_ranges: selectedPortRanges
      };
      
      // Step 3: Validate configuration
      setCurrentStep(3);
      setMessage('Step 3: Validating NAP configuration...');
      
      const validation = validateNapConfig(napConfig);
      if (!validation.isValid) {
        setMessage(`❌ Validation Error: ${validation.errors.join(', ')}`);
        setLoading(false);
        setCurrentStep(1);
        return;
      }
      
      if (validation.warnings.length > 0) {
        console.warn('NAP Configuration Warnings:', validation.warnings);
      }
      
      // Step 4: Create NAP using ProSBC workflow
      setCurrentStep(4);
      setMessage('Step 4: Creating NAP using ProSBC workflow...');
      
      console.log('NAP Configuration being sent:', {
        name: napConfig.name,
        enabled: napConfig.enabled,
        sip_destination_ip: napConfig.sip_destination_ip,
        sip_destination_port: napConfig.sip_destination_port,
        sip_servers_count: napConfig.sip_servers?.length || 0,
        port_ranges_count: napConfig.port_ranges?.length || 0,
        has_auth: !!(napConfig.sip_auth_user && napConfig.sip_auth_pass)
      });
      
      const result = await createNapAPI(napConfig);
      
      console.log('NAP Creation Result:', result);
      
      const totalTime = Date.now() - startTime;
      console.log(`⏱️ Total NAP creation time: ${totalTime}ms`);
      
      if (result.success) {
        setCurrentStep(5);
        const executionTime = result.executionTime || totalTime;
        const successMsg = result.napId 
          ? `✅ ${result.message} (ID: ${result.napId}) - Created in ${executionTime}ms`
          : `✅ ${result.message} - Created in ${executionTime}ms`;
        setMessage(successMsg);
        
        // Record NAP creation in database
        try {
          const dbService = new ClientDatabaseService();
          await dbService.createNap({
            name: napName,  // Changed from napName
            napId: result.napId,
            enabled: enabled,
            defaultProfile: defaultProfile,
            proxyAddress: proxyAddress,
            proxyPort: proxyPort,
            useProxy: useProxy,
            registerToProxy: registerToProxy,
            config_data: napConfig,  // Changed from config
            prosbc_result: result,
            executionTimeMs: executionTime
          });
          console.log('✅ NAP recorded in database');
        } catch (dbError) {
          console.error('Database recording error:', dbError);
          // Don't fail the whole process if database recording fails
        }
        
        // Reset form after successful creation
        setTimeout(() => {
          resetForm();
          setMessage('');
          setCurrentStep(1);
        }, 8000); // Longer delay to read the success message
      } else {
        setMessage(`❌ ${result.message}`);
        setCurrentStep(1);
      }
      
    } catch (error) {
      console.error('NAP creation error:', error);
      
      if (error.message.includes('Authentication') || error.message.includes('credentials')) {
        setMessage('❌ Authentication failed. Clearing session cache and retrying...');
        clearSessionCache(); // Clear the cached session
        if (onAuthError) onAuthError();
      } else if (error.message.includes('timeout') || error.message.includes('network')) {
        setMessage('❌ Network error. Please check your connection and try again.');
        clearSessionCache(); // Clear cache on network issues
      } else {
        setMessage(`❌ Error: ${error.message}`);
      }
      
      setCurrentStep(1);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setNapName('');
    setProxyAddress('');
    setProxyPort('5060');
    setRealm('');
    setAuthUser('');
    setAuthPassword('');
    setAddressToRegister('');
    setSelectedSipServers([]);
    setSelectedPortRanges([]);
  };
  
  // These functions are now replaced by direct onChange handlers in the select elements

  return (
    <div className="nap-creator-enhanced">
      <div className="nap-creator-header">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2>Create New NAP</h2>
            <p>Create a Network Access Point with full ProSBC configuration</p>
          </div>
          
        </div>
        {currentStep > 1 && (
          <div className="creation-progress">
            <span>Step {currentStep} of 5</span>
          </div>
        )}
      </div>

      {/* Performance Metrics */}
      {showPerformanceMetrics && (
        <PerformanceMetrics 
          showDetails={true}
          autoRefresh={true}
          refreshInterval={5000}
        />
      )}

      {/* Status Message */}
      {message && (
        <div className={`message ${message.includes('❌') ? 'error' : message.includes('✅') ? 'success' : 'info'}`}>
          {message}
        </div>
      )}

      <form className="nap-form" onSubmit={(e) => { e.preventDefault(); createNapWithProSBCWorkflow(); }}>
        {/* Basic Configuration */}
        <div className="form-section">
          <h3>Basic Configuration</h3>
          
          <div className="form-group">
            <label htmlFor="napName">NAP Name *</label>
            <input
              type="text"
              id="napName"
              value={napName}
              onChange={(e) => setNapName(e.target.value)}
              placeholder="Enter NAP name (e.g., VEN_ATX_66)"
              required
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="defaultProfile">Default Profile</label>
            <select
              id="defaultProfile"
              value={defaultProfile}
              onChange={(e) => setDefaultProfile(e.target.value)}
              disabled={loading}
            >
              {availableProfiles.map(profile => (
                <option key={profile.value} value={profile.value}>
                  {profile.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* SIP Proxy Configuration */}
        <div className="form-section">
          <h3>SIP Proxy Configuration</h3>
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={useProxy}
                onChange={(e) => setUseProxy(e.target.checked)}
                disabled={loading}
              />
              Use Proxy Address
            </label>
          </div>
          
          {useProxy && (
            <>
              <div className="form-group">
                <label htmlFor="proxyAddress">Proxy Address *</label>
                <input
                  type="text"
                  id="proxyAddress"
                  value={proxyAddress}
                  onChange={(e) => setProxyAddress(e.target.value)}
                  placeholder="IP address or domain name"
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="proxyPort">Proxy Port</label>
                <input
                  type="text"
                  id="proxyPort"
                  value={proxyPort}
                  onChange={(e) => setProxyPort(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={filterByProxyPort}
                    onChange={(e) => setFilterByProxyPort(e.target.checked)}
                    disabled={loading}
                  />
                  Filter by proxy port
                </label>
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={pollRemoteProxy}
                    onChange={(e) => setPollRemoteProxy(e.target.checked)}
                    disabled={loading}
                  />
                  Poll Remote Proxy
                </label>
              </div>
              
              {pollRemoteProxy && (
                <div className="form-group">
                  <label htmlFor="proxyPollingInterval">Proxy Polling Interval</label>
                  <div className="input-with-unit">
                    <input
                      type="text"
                      id="proxyPollingInterval"
                      value={proxyPollingInterval}
                      onChange={(e) => setProxyPollingInterval(e.target.value)}
                      disabled={loading}
                    />
                    <select
                      value={proxyPollingIntervalUnit}
                      onChange={(e) => setProxyPollingIntervalUnit(e.target.value)}
                      disabled={loading}
                    >
                      <option value="60000.0">minutes</option>
                      <option value="1000.0">seconds</option>
                      <option value="1.0">milliseconds</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* SIP Transport Servers */}
        <div className="form-section">
          <h3>SIP Transport Servers</h3>
          <div className="form-group">
            <label htmlFor="sipServers">Select SIP Servers</label>
            <select
              id="sipServers"
              multiple
              value={selectedSipServers}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                setSelectedSipServers(selectedOptions);
              }}
              className="multi-select"
              disabled={loading}
            >
              {availableSipServers.map(server => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Port Ranges */}
        <div className="form-section">
          <h3>Port Ranges</h3>
          <div className="form-group">
            <label htmlFor="portRanges">Select Port Ranges</label>
            <select
              id="portRanges"
              multiple
              value={selectedPortRanges}
              onChange={(e) => {
                const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                setSelectedPortRanges(selectedOptions);
              }}
              className="multi-select"
              disabled={loading}
            >
              {availablePortRanges.map(range => (
                <option key={range.id} value={range.id}>
                  {range.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Collapsible Advanced Sections */}
        <div className="form-section">
          <button
            type="button"
            className="section-toggle"
            onClick={() => setShowRegistrationParams(!showRegistrationParams)}
          >
            Registration Parameters {showRegistrationParams ? '▼' : '▶'}
          </button>
          
          {showRegistrationParams && (
            <div className="collapsible-content">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={registerToProxy}
                    onChange={(e) => setRegisterToProxy(e.target.checked)}
                    disabled={loading}
                  />
                  Register to Proxy
                </label>
              </div>
              
              <div className="form-group">
                <label htmlFor="addressToRegister">Address to register</label>
                <input
                  type="text"
                  id="addressToRegister"
                  value={addressToRegister}
                  onChange={(e) => setAddressToRegister(e.target.value)}
                  placeholder="sip:username@hostname"
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        <div className="form-section">
          <button
            type="button"
            className="section-toggle"
            onClick={() => setShowAuthParams(!showAuthParams)}
          >
            Authentication Parameters {showAuthParams ? '▼' : '▶'}
          </button>
          
          {showAuthParams && (
            <div className="collapsible-content">
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={ignoreRealm}
                    onChange={(e) => setIgnoreRealm(e.target.checked)}
                    disabled={loading}
                  />
                  Ignore realm
                </label>
              </div>
              
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={reuseChallenge}
                    onChange={(e) => setReuseChallenge(e.target.checked)}
                    disabled={loading}
                  />
                  Reuse challenge
                </label>
              </div>
              
              <div className="form-group">
                <label htmlFor="realm">Realm</label>
                <input
                  type="text"
                  id="realm"
                  value={realm}
                  onChange={(e) => setRealm(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="authUser">User</label>
                <input
                  type="text"
                  id="authUser"
                  value={authUser}
                  onChange={(e) => setAuthUser(e.target.value)}
                  disabled={loading}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="authPassword">Password</label>
                <input
                  type="password"
                  id="authPassword"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="form-actions">
          <button
            type="submit"
            className="create-button"
            disabled={loading || !napName.trim()}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Creating NAP...
              </>
            ) : (
              'Create NAP'
            )}
          </button>
          
          <button
            type="button"
            className="reset-button"
            onClick={resetForm}
            disabled={loading}
          >
            Reset Form
          </button>
          
          <button
            type="button"
            className="clear-cache-button"
            onClick={() => {
              clearSessionCache();
              setMessage('🔄 Session cache cleared. Next NAP creation will establish a fresh session.');
              setTimeout(() => setMessage(''), 3000);
            }}
            disabled={loading}
            title="Clear cached session and authentication tokens"
          >
            Clear Cache
          </button>
          
          <button
            type="button"
            className="debug-button"
            onClick={async () => {
              if (!napName.trim()) {
                setMessage('❌ Please enter a NAP name to debug');
                return;
              }
              
              setMessage('🔍 Running debug check...');
              console.log('=== DEBUG NAP EXISTENCE CHECK ===');
              const debugResult = await debugNapExistence(napName);
              console.log('Debug completed:', debugResult);
              
              if (debugResult.error) {
                setMessage(`❌ Debug error: ${debugResult.error}`);
              } else {
                setMessage(`🔍 Debug completed. Check console for detailed results.`);
              }
              
              setTimeout(() => setMessage(''), 5000);
            }}
            disabled={loading}
            title="Debug NAP existence check"
          >
            Debug Check
          </button>
        </div>
      </form>
    </div>
  );
};

export default NapCreatorEnhanced;
