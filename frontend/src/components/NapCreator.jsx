import React, { useState, useEffect } from "react";
import { 
  createNap, 
  createSipProxyNap, 
  createSimpleNap, 
  validateNapData, 
  checkNapExists 
} from "../utils/napApiClientFixed";

function NapCreator({ onAuthError }) {
  // Basic NAP configuration (Main form)
  const [napName, setNapName] = useState("VEN_ATX_66");
  const [enabled, setEnabled] = useState(true); // Always enabled, not shown in UI
  const [defaultProfile, setDefaultProfile] = useState("default");
  
  // Proxy Configuration
  const [sipUseProxy, setSipUseProxy] = useState(true);
  const [proxyAddress, setProxyAddress] = useState("69.87.154.10");
  const [proxyPort, setProxyPort] = useState("5060");
  const [filterByProxyPort, setFilterByProxyPort] = useState(true);
  const [pollRemoteProxy, setPollRemoteProxy] = useState(true);
  const [proxyPollingInterval, setProxyPollingInterval] = useState("1");
  const [proxyPollingIntervalUnit, setProxyPollingIntervalUnit] = useState("minutes");
  const [acceptOnlyAuthorizedUsers, setAcceptOnlyAuthorizedUsers] = useState(false);
  
  // Registration Parameters
  const [registerToProxy, setRegisterToProxy] = useState(false);
  const [addressToRegister, setAddressToRegister] = useState("");
  
  // Authentication Parameters
  const [ignoreRealm, setIgnoreRealm] = useState(false);
  const [reuseChallenge, setReuseChallenge] = useState(false);
  const [realm, setRealm] = useState("");
  const [authUser, setAuthUser] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  
  // Network Address Translation (NAT)
  const [remoteMethodRtp, setRemoteMethodRtp] = useState("None");
  const [remoteMethodSip, setRemoteMethodSip] = useState("None");
  const [localMethodRtp, setLocalMethodRtp] = useState("");
  const [localMethodSip, setLocalMethodSip] = useState("");
  
  // SIP-I Parameters
  const [sipiEnable, setSipiEnable] = useState(false);
  const [isupProtocolVariant, setIsupProtocolVariant] = useState("ITU");
  const [contentType, setContentType] = useState("itu-t");
  const [callProgressMethod, setCallProgressMethod] = useState("183 Call Progress");
  const [appendFToOutgoingCalls, setAppendFToOutgoingCalls] = useState(false);
  
  // Advanced Parameters
  const [mapAnyResponseToAvailableStatus, setMapAnyResponseToAvailableStatus] = useState(true);
  const [responseTimeout, setResponseTimeout] = useState("12");
  const [responseTimeoutUnit, setResponseTimeoutUnit] = useState("seconds");
  const [proxyPollingMaxForwards, setProxyPollingMaxForwards] = useState("1");
  const [triggersCallProgress, setTriggersCallProgress] = useState(false);
  const [privacyType, setPrivacyType] = useState("P-Asserted-Identity");
  
  // SIP Transport Servers
  const [selectedSipServers, setSelectedSipServers] = useState([]);
  const [availableSipServers] = useState([
    { id: "2", name: "SIP_voip_66_5060" },
    { id: "3", name: "SIP_voip_67_5060" },
    { id: "5", name: "SIP_voip_68_5060" },
    { id: "4", name: "SIP_voip_69_5060" },
    { id: "6", name: "SIP_voip_70_5060" }
  ]);
  
  // Port Range (VOIP media only)
  const [selectedPortRanges, setSelectedPortRanges] = useState([]);
  const [availablePortRanges] = useState([
    { id: "3", name: "Host.pr_Public_66" },
    { id: "4", name: "Host.pr_Public_67" },
    { id: "5", name: "Host.pr_Public_68" },
    { id: "6", name: "Host.pr_Public_69" },
    { id: "7", name: "Host.pr_Public_70" }
  ]);
  
  // Call Rate Limiting
  const [maxCallsPerSecond, setMaxCallsPerSecond] = useState("0");
  const [maxIncomingCallsPerSecond, setMaxIncomingCallsPerSecond] = useState("0");
  const [maxOutgoingCallsPerSecond, setMaxOutgoingCallsPerSecond] = useState("0");
  const [maxSimultaneousIncomingCalls, setMaxSimultaneousIncomingCalls] = useState("0");
  const [maxSimultaneousOutgoingCalls, setMaxSimultaneousOutgoingCalls] = useState("0");
  const [maxSimultaneousTotalCalls, setMaxSimultaneousTotalCalls] = useState("0");
  const [processingDelayLowThreshold, setProcessingDelayLowThreshold] = useState("3");
  const [processingDelayLowUnit, setProcessingDelayLowUnit] = useState("seconds");
  const [processingDelayHighThreshold, setProcessingDelayHighThreshold] = useState("6");
  const [processingDelayHighUnit, setProcessingDelayHighUnit] = useState("seconds");
  
  // Congestion Threshold
  const [nbCallsPerPeriod, setNbCallsPerPeriod] = useState("1");
  const [periodDuration, setPeriodDuration] = useState("1");
  const [periodDurationUnit, setPeriodDurationUnit] = useState("minutes");
  
  // Form sections visibility
  const [showRegistrationParams, setShowRegistrationParams] = useState(false);
  const [showAuthParams, setShowAuthParams] = useState(false);
  const [showNatParams, setShowNatParams] = useState(false);
  const [showSipiParams, setShowSipiParams] = useState(false);
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [showCallRateLimit, setShowCallRateLimit] = useState(false);
  const [showCongestionThreshold, setShowCongestionThreshold] = useState(true);
  
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Handle responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleCreateNAP = async (creationType = 'full') => {
    setIsLoading(true);
    setIsDuplicateChecking(true);
    setMessage("Checking for duplicate NAP names...");

    try {
      // First, check if NAP already exists
      const napExists = await checkNapExists(napName);
      
      if (napExists) {
        setMessage(`❌ Error: A NAP with the name "${napName}" already exists in ProSBC. Please choose a different name.`);
        setIsLoading(false);
        setIsDuplicateChecking(false);
        return;
      }

      setIsDuplicateChecking(false);
      setMessage("Creating NAP using ProSBC workflow... This may take up to 2 minutes.");

      let result;
      
      if (creationType === 'simple') {
        // Create simple NAP (name only)
        setMessage("Creating simple NAP (name only)...");
        result = await createSimpleNap(napName, enabled);
      } else if (creationType === 'proxy') {
        // Create SIP Proxy NAP with basic proxy configuration
        setMessage("Creating SIP Proxy NAP...");
        const proxyConfig = {
          name: napName,
          enabled: enabled,
          profile_id: defaultProfile === 'default' ? '1' : '2',
          proxy_address: proxyAddress,
          proxy_port: proxyPort,
          realm: realm,
          username: authUser,
          password: authPassword,
          aor: addressToRegister
        };
        
        // Validate before creation
        const validation = validateNapData(proxyConfig);
        if (!validation.isValid) {
          setMessage(`❌ Validation Error: ${validation.errors.join(', ')}`);
          setIsLoading(false);
          return;
        }
        
        if (validation.warnings.length > 0) {
          console.warn('NAP warnings:', validation.warnings);
        }
        
        result = await createSipProxyNap(proxyConfig);
      } else {
        // Full configuration
        setMessage("Creating NAP with full configuration...");
        const fullConfig = buildFullNapConfig();
        
        // Validate before creation
        const validation = validateNapData(fullConfig);
        if (!validation.isValid) {
          setMessage(`❌ Validation Error: ${validation.errors.join(', ')}`);
          setIsLoading(false);
          return;
        }
        
        if (validation.warnings.length > 0) {
          console.warn('NAP warnings:', validation.warnings);
        }
        
        result = await createNap(fullConfig);
      }

      if (result.success) {
        setMessage(`✅ ${result.message}`);
        if (result.napId) {
          setMessage(prev => prev + ` You can configure it further at: /naps/${result.napId}/edit`);
        }
        
        // Reset form after successful creation
        setTimeout(() => {
          setNapName(`${napName}_copy`);
          setMessage("");
        }, 3000);
      } else {
        setMessage(`❌ ${result.message}`);
      }

    } catch (error) {
      console.error("NAP creation error:", error);
      
      if (error.message.includes('Authentication')) {
        setMessage("❌ Authentication failed. Please check your .env file credentials.");
        if (onAuthError) onAuthError();
      } else {
        setMessage(`❌ Error: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
      setIsDuplicateChecking(false);
    }
  };
  
  // Build full NAP configuration from form data
  const buildFullNapConfig = () => {
    return {
      name: napName,
      enabled: enabled,
      profile_id: defaultProfile === 'default' ? '1' : (defaultProfile === 'asterisk' ? '2' : '3'),
      
      // SIP Configuration
      sip_destination_ip: sipUseProxy ? proxyAddress : '',
      sip_destination_port: sipUseProxy ? proxyPort : '5060',
      
      // Authentication
      sip_auth_realm: realm,
      sip_auth_user: authUser,
      sip_auth_pass: authPassword,
      
      // Registration
      aor: registerToProxy ? addressToRegister : '',
      
      // Advanced settings from form
      sip_use_proxy: sipUseProxy,
      filter_by_proxy_port: filterByProxyPort,
      poll_remote_proxy: pollRemoteProxy,
      proxy_polling_interval: proxyPollingInterval,
      proxy_polling_interval_unit: proxyPollingIntervalUnit,
      accept_only_authorized_users: acceptOnlyAuthorizedUsers,
      register_to_proxy: registerToProxy,
      sip_auth_ignore_realm: ignoreRealm,
      sip_auth_reuse_challenge: reuseChallenge,
      
      // Rate limiting
      rate_limit_cps: maxCallsPerSecond || '0',
      rate_limit_cps_in: maxIncomingCallsPerSecond || '0',
      rate_limit_cps_out: maxOutgoingCallsPerSecond || '0',
      max_incoming_calls: maxSimultaneousIncomingCalls || '0',
      max_outgoing_calls: maxSimultaneousOutgoingCalls || '0',
      max_incoming_outgoing_calls: maxSimultaneousTotalCalls || '0',
      
      // Congestion threshold
      congestion_threshold_nb_calls: nbCallsPerPeriod || '1',
      congestion_threshold_period_sec: periodDuration || '1',
      
      // Selected servers and port ranges (these would be handled separately in real ProSBC)
      selected_sip_servers: selectedSipServers,
      selected_port_ranges: selectedPortRanges
    };
  };


  // Function to check and display existing NAPs
  const handleCheckExistingNaps = async () => {
    setIsLoading(true);
    setMessage("Fetching existing NAPs from ProSBC...");
    
    try {
      const { fetchExistingNaps } = await import("../utils/napApiClientFixed");
      const existingNaps = await fetchExistingNaps();
      
      console.log('Fetched NAPs data:', existingNaps);
      console.log('NAPs data type:', typeof existingNaps);
      console.log('NAPs keys:', Object.keys(existingNaps || {}));
      
      // Filter out the meta information
      const napNames = Object.keys(existingNaps).filter(name => name !== '***meta***');
      
      if (napNames.length === 0) {
        setMessage("📋 No existing NAPs found in ProSBC (or response format unexpected).\n\nDebug info:\n" + 
                  `Response type: ${typeof existingNaps}\n` +
                  `Response keys: ${Object.keys(existingNaps || {}).join(', ')}\n` +
                  `Raw response: ${JSON.stringify(existingNaps).substring(0, 200)}...`);
      } else {
        const napCount = napNames.length;
        const napList = napNames.join(', ');
        const currentNapExists = napNames.includes(napName);
        setMessage(`📋 Found ${napCount} existing NAPs in ProSBC:\n\n${napList}\n\n${currentNapExists ? `❌ NAP name "${napName}" ALREADY EXISTS!` : `✅ NAP name "${napName}" is available`}`);
      }
    } catch (error) {
      console.error("Error fetching NAPs:", error);
      setMessage(`❌ Error fetching existing NAPs: ${error.message}\n\nThis could be due to:\n1. Authentication issues\n2. Server returning HTML instead of JSON\n3. Network connectivity problems\n4. ProSBC server configuration`);
    } finally {
      setIsLoading(false);
    }
  };

  // Message styling function
  const getMessageClasses = () => {
    if (message.includes("✅") || message.includes("success")) {
      return "bg-green-50 text-green-800 border-green-200 border-l-4 border-l-green-500";
    } else if (message.includes("❌") || message.includes("Error")) {
      return "bg-red-50 text-red-800 border-red-200 border-l-4 border-l-red-500";
    } else if (message.includes("⚠️") || message.includes("Warning")) {
      return "bg-yellow-50 text-yellow-800 border-yellow-200 border-l-4 border-l-yellow-500";
    } else if (message.includes("📋") || message.includes("Checking") || message.includes("Fetching")) {
      return "bg-blue-50 text-blue-800 border-blue-200 border-l-4 border-l-blue-500";
    }
    return "bg-gray-50 text-gray-800 border-gray-200 border-l-4 border-l-gray-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        
       

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            🚀 ProSBC NAP Creator
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Create and configure Network Access Points with the exact ProSBC form structure
          </p>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-8">
          <div className="flex items-center mb-6">
            <span className="text-3xl mr-3">⚙️</span>
            <h2 className="text-2xl font-bold text-gray-800">Editing NAP</h2>
          </div>
          
          {/* Basic Configuration */}
          <div className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Name</label>
              <input
                className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                type="text"
                value={napName}
                onChange={(e) => setNapName(e.target.value)}
                placeholder="Name of this NAP"
              />
            </div>


            {/* Default Profile */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">Default Profile</label>
              <select
                className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                value={defaultProfile}
                onChange={(e) => setDefaultProfile(e.target.value)}
              >
                <option value="asterisk">asterisk</option>
                <option value="default">default</option>
                <option value="freeswitch">freeswitch</option>
              </select>
              <span className="text-xs text-gray-500">
                Profile to use for calls using this NAP (unless overwritten by route's profile)
              </span>
            </div>

            {/* Use Proxy Address */}
            <div className="flex items-center space-x-3">
              <input
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                type="checkbox"
                checked={sipUseProxy}
                onChange={(e) => setSipUseProxy(e.target.checked)}
              />
              <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                Use Proxy Address
              </label>
              <span className="text-xs text-gray-500">
                (All request sent on this NAP will be sent to the designated proxy)
              </span>
            </div>

            {/* Proxy Configuration - Only shown when Use Proxy is enabled */}
            {sipUseProxy && (
              <div className="ml-8 space-y-6 p-6 bg-blue-50 rounded-xl border border-blue-200">
                {/* Proxy Address */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Proxy address</label>
                  <input
                    className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                    type="text"
                    value={proxyAddress}
                    onChange={(e) => setProxyAddress(e.target.value)}
                    placeholder="IP address, or domain name of the SIP Proxy"
                  />
                </div>

                {/* Proxy Port */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Proxy port</label>
                  <input
                    className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                    type="text"
                    value={proxyPort}
                    onChange={(e) => setProxyPort(e.target.value)}
                    placeholder="UDP/TCP port of the SIP Proxy"
                  />
                </div>

                {/* Filter by proxy port */}
                <div className="flex items-center space-x-3">
                  <input
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    type="checkbox"
                    checked={filterByProxyPort}
                    onChange={(e) => setFilterByProxyPort(e.target.checked)}
                  />
                  <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Filter by proxy port
                  </label>
                </div>

                {/* Poll Remote Proxy */}
                <div className="flex items-center space-x-3">
                  <input
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    type="checkbox"
                    checked={pollRemoteProxy}
                    onChange={(e) => setPollRemoteProxy(e.target.checked)}
                  />
                  <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Poll Remote Proxy
                  </label>
                  <span className="text-xs text-gray-500">
                    (Enables polling of proxy to detect availability)
                  </span>
                </div>

                {/* Proxy Polling Configuration - Only shown when Poll Remote Proxy is enabled */}
                {pollRemoteProxy && (
                  <div className="ml-8 space-y-4 p-4 bg-blue-100 rounded-lg border border-blue-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">Proxy Polling Interval</label>
                        <div className="flex space-x-2">
                          <input
                            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                            type="text"
                            value={proxyPollingInterval}
                            onChange={(e) => setProxyPollingInterval(e.target.value)}
                          />
                          <select
                            className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                            value={proxyPollingIntervalUnit}
                            onChange={(e) => setProxyPollingIntervalUnit(e.target.value)}
                          >
                            <option value="minutes">minutes</option>
                            <option value="seconds">seconds</option>
                            <option value="milliseconds">milliseconds</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Accept only authorized users */}
            <div className="flex items-center space-x-3">
              <input
                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                type="checkbox"
                checked={acceptOnlyAuthorizedUsers}
                onChange={(e) => setAcceptOnlyAuthorizedUsers(e.target.checked)}
              />
              <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                Accept only authorized users
              </label>
              <span className="text-xs text-gray-500">
                (Only registered users on the domain will be able to make calls)
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Sections */}
        
        {/* Registration Parameters */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div 
            className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            onClick={() => setShowRegistrationParams(!showRegistrationParams)}
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">📝</span>
              <h3 className="text-xl font-bold text-gray-800">Registration Parameters</h3>
            </div>
            <span className="text-2xl text-gray-400">
              {showRegistrationParams ? '−' : '+'}
            </span>
          </div>
          
          {showRegistrationParams && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-100">
              {/* Register to Proxy */}
              <div className="flex items-center space-x-3 pt-6">
                <input
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                  type="checkbox"
                  checked={registerToProxy}
                  onChange={(e) => setRegisterToProxy(e.target.checked)}
                />
                <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                  Register to Proxy?
                </label>
                <span className="text-xs text-gray-500">
                  (Enables registering to a proxy)
                </span>
              </div>

              {/* Address to register */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Address to register</label>
                <input
                  className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                  type="text"
                  value={addressToRegister}
                  onChange={(e) => setAddressToRegister(e.target.value)}
                  placeholder="sip:username@hostname"
                />
                <span className="text-xs text-gray-500">
                  Address of record to use when registering to proxy. Format is: sip:username@hostname
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Authentication Parameters */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div 
            className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            onClick={() => setShowAuthParams(!showAuthParams)}
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">🔐</span>
              <h3 className="text-xl font-bold text-gray-800">Authentication Parameters</h3>
            </div>
            <span className="text-2xl text-gray-400">
              {showAuthParams ? '−' : '+'}
            </span>
          </div>
          
          {showAuthParams && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-100">
              <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Ignore realm */}
                <div className="flex items-center space-x-3">
                  <input
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    type="checkbox"
                    checked={ignoreRealm}
                    onChange={(e) => setIgnoreRealm(e.target.checked)}
                  />
                  <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Ignore realm
                  </label>
                </div>

                {/* Reuse challenge */}
                <div className="flex items-center space-x-3">
                  <input
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    type="checkbox"
                    checked={reuseChallenge}
                    onChange={(e) => setReuseChallenge(e.target.checked)}
                  />
                  <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Reuse challenge
                  </label>
                </div>

                {/* Realm */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Realm</label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                    type="text"
                    value={realm}
                    onChange={(e) => setRealm(e.target.value)}
                    placeholder="Authentication realm"
                  />
                </div>

                {/* User */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">User</label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                    type="text"
                    value={authUser}
                    onChange={(e) => setAuthUser(e.target.value)}
                    placeholder="Authentication user"
                  />
                </div>

                {/* Password */}
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700">Password</label>
                  <input
                    className="w-full max-w-md px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                    type="text"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Authentication password"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Network Address Translation (NAT) */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div 
            className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            onClick={() => setShowNatParams(!showNatParams)}
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">🌐</span>
              <h3 className="text-xl font-bold text-gray-800">Network Address Translation (NAT)</h3>
            </div>
            <span className="text-2xl text-gray-400">
              {showNatParams ? '−' : '+'}
            </span>
          </div>
          
          {showNatParams && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-100">
              <div className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Remote Method for RTP */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Remote Method for RTP</label>
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                    value={remoteMethodRtp}
                    onChange={(e) => setRemoteMethodRtp(e.target.value)}
                  >
                    <option value="None">None</option>
                    <option value="Force Passive Mode">Force Passive Mode</option>
                    <option value="Parse Direction Attribute">Parse Direction Attribute</option>
                  </select>
                </div>

                {/* Remote Method for SIP */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Remote Method for SIP</label>
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                    value={remoteMethodSip}
                    onChange={(e) => setRemoteMethodSip(e.target.value)}
                  >
                    <option value="None">None</option>
                    <option value="Automatic NAT traversal">Automatic NAT traversal</option>
                    <option value="Force Use of Public IP/Port or FQDN">Force Use of Public IP/Port or FQDN</option>
                  </select>
                </div>

                {/* Local NAT Method for RTP */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Local NAT Method for RTP</label>
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                    value={localMethodRtp}
                    onChange={(e) => setLocalMethodRtp(e.target.value)}
                  >
                    <option value="">No NAT</option>
                  </select>
                </div>

                {/* Local NAT Method for SIP */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">Local NAT Method for SIP</label>
                  <select
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                    value={localMethodSip}
                    onChange={(e) => setLocalMethodSip(e.target.value)}
                  >
                    <option value="">No NAT</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SIP-I Parameters */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div 
            className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            onClick={() => setShowSipiParams(!showSipiParams)}
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">📡</span>
              <h3 className="text-xl font-bold text-gray-800">SIP-I Parameters</h3>
            </div>
            <span className="text-2xl text-gray-400">
              {showSipiParams ? '−' : '+'}
            </span>
          </div>
          
          {showSipiParams && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-100">
              <div className="pt-6 space-y-6">
                {/* Enable SIP-I */}
                <div className="flex items-center space-x-3">
                  <input
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    type="checkbox"
                    checked={sipiEnable}
                    onChange={(e) => setSipiEnable(e.target.checked)}
                  />
                  <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Enable
                  </label>
                  <span className="text-xs text-gray-500">
                    (Enable SIP-I mode for this NAP)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ISUP Protocol Variant */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">ISUP Protocol Variant</label>
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                      value={isupProtocolVariant}
                      onChange={(e) => setIsupProtocolVariant(e.target.value)}
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

                  {/* Content-Type */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Content-Type</label>
                    <input
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                      type="text"
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value)}
                      placeholder="itu-t"
                    />
                  </div>

                  {/* Call Progress Method */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Call Progress Method</label>
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                      value={callProgressMethod}
                      onChange={(e) => setCallProgressMethod(e.target.value)}
                    >
                      <option value="183 Call Progress">183 Call Progress</option>
                      <option value="SIP_INFO">SIP_INFO</option>
                    </select>
                  </div>

                  {/* Append F to outgoing calls */}
                  <div className="flex items-center space-x-3">
                    <input
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      type="checkbox"
                      checked={appendFToOutgoingCalls}
                      onChange={(e) => setAppendFToOutgoingCalls(e.target.checked)}
                    />
                    <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                      Append F to outgoing calls
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Advanced Parameters */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div 
            className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            onClick={() => setShowAdvancedParams(!showAdvancedParams)}
          >
            <div className="flex items-center">
              <span className="text-2xl mr-3">⚙️</span>
              <h3 className="text-xl font-bold text-gray-800">Advanced Parameters</h3>
            </div>
            <span className="text-2xl text-gray-400">
              {showAdvancedParams ? '−' : '+'}
            </span>
          </div>
          
          {showAdvancedParams && (
            <div className="px-6 pb-6 space-y-6 border-t border-gray-100">
              <div className="pt-6 space-y-6">
                {/* Map any response to available status */}
                <div className="flex items-center space-x-3">
                  <input
                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    type="checkbox"
                    checked={mapAnyResponseToAvailableStatus}
                    onChange={(e) => setMapAnyResponseToAvailableStatus(e.target.checked)}
                  />
                  <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Map any response to available status
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Response Timeout */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Response Timeout</label>
                    <div className="flex space-x-2">
                      <input
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                        type="text"
                        value={responseTimeout}
                        onChange={(e) => setResponseTimeout(e.target.value)}
                      />
                      <select
                        className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                        value={responseTimeoutUnit}
                        onChange={(e) => setResponseTimeoutUnit(e.target.value)}
                      >
                        <option value="minutes">minutes</option>
                        <option value="seconds">seconds</option>
                        <option value="milliseconds">milliseconds</option>
                      </select>
                    </div>
                  </div>

                  {/* Poll Max-Forwards */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Poll Max-Forwards</label>
                    <div className="flex items-center space-x-2">
                      <input
                        className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                        type="text"
                        value={proxyPollingMaxForwards}
                        onChange={(e) => setProxyPollingMaxForwards(e.target.value)}
                      />
                      <span className="text-sm text-gray-500">Hops</span>
                    </div>
                  </div>

                  {/* 183 triggers call progress */}
                  <div className="flex items-center space-x-3">
                    <input
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      type="checkbox"
                      checked={triggersCallProgress}
                      onChange={(e) => setTriggersCallProgress(e.target.checked)}
                    />
                    <label className="text-sm font-semibold text-gray-700 cursor-pointer">
                      183 triggers call progress
                    </label>
                  </div>

                  {/* Privacy type */}
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Privacy type</label>
                    <select
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                      value={privacyType}
                      onChange={(e) => setPrivacyType(e.target.value)}
                    >
                      <option value="None">None</option>
                      <option value="Remote-Party-Id">Remote-Party-Id</option>
                      <option value="P-Asserted-Identity">P-Asserted-Identity</option>
                      <option value="Both">Both</option>
                    </select>
                  </div>
                </div>

                {/* Call Rate Limiting Section */}
                <div className="mt-8">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded-lg border border-gray-200"
                    onClick={() => setShowCallRateLimit(!showCallRateLimit)}
                  >
                    <h4 className="text-lg font-bold text-gray-800">Call rate limiting</h4>
                    <span className="text-xl text-gray-400">
                      {showCallRateLimit ? '−' : '+'}
                    </span>
                  </div>
                  
                  {showCallRateLimit && (
                    <div className="mt-4 space-y-6 p-4 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Maximum calls per second */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">Maximum calls per second</label>
                          <div className="flex items-center space-x-2">
                            <input
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                              type="text"
                              value={maxCallsPerSecond}
                              onChange={(e) => setMaxCallsPerSecond(e.target.value)}
                            />
                            <span className="text-sm text-gray-500">calls per second</span>
                          </div>
                        </div>

                        {/* Maximum incoming calls per second */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">Maximum incoming calls per second</label>
                          <div className="flex items-center space-x-2">
                            <input
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                              type="text"
                              value={maxIncomingCallsPerSecond}
                              onChange={(e) => setMaxIncomingCallsPerSecond(e.target.value)}
                            />
                            <span className="text-sm text-gray-500">calls per second</span>
                          </div>
                        </div>

                        {/* Maximum outgoing calls per second */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">Maximum outgoing calls per second</label>
                          <div className="flex items-center space-x-2">
                            <input
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                              type="text"
                              value={maxOutgoingCallsPerSecond}
                              onChange={(e) => setMaxOutgoingCallsPerSecond(e.target.value)}
                            />
                            <span className="text-sm text-gray-500">calls per second</span>
                          </div>
                        </div>

                        {/* Maximum simultaneous incoming calls */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">Maximum simultaneous incoming calls</label>
                          <div className="flex items-center space-x-2">
                            <input
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                              type="text"
                              value={maxSimultaneousIncomingCalls}
                              onChange={(e) => setMaxSimultaneousIncomingCalls(e.target.value)}
                            />
                            <span className="text-sm text-gray-500">calls</span>
                          </div>
                        </div>

                        {/* Maximum simultaneous outgoing calls */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">Maximum simultaneous outgoing calls</label>
                          <div className="flex items-center space-x-2">
                            <input
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                              type="text"
                              value={maxSimultaneousOutgoingCalls}
                              onChange={(e) => setMaxSimultaneousOutgoingCalls(e.target.value)}
                            />
                            <span className="text-sm text-gray-500">calls</span>
                          </div>
                        </div>

                        {/* Maximum simultaneous total calls */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">Maximum simultaneous total calls</label>
                          <div className="flex items-center space-x-2">
                            <input
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                              type="text"
                              value={maxSimultaneousTotalCalls}
                              onChange={(e) => setMaxSimultaneousTotalCalls(e.target.value)}
                            />
                            <span className="text-sm text-gray-500">calls</span>
                          </div>
                        </div>

                        {/* Processing delay low threshold */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">Processing delay low threshold</label>
                          <div className="flex space-x-2">
                            <input
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                              type="text"
                              value={processingDelayLowThreshold}
                              onChange={(e) => setProcessingDelayLowThreshold(e.target.value)}
                            />
                            <select
                              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                              value={processingDelayLowUnit}
                              onChange={(e) => setProcessingDelayLowUnit(e.target.value)}
                            >
                              <option value="seconds">seconds</option>
                              <option value="milliseconds">milliseconds</option>
                            </select>
                          </div>
                        </div>

                        {/* Processing delay high threshold */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">Processing delay high threshold</label>
                          <div className="flex space-x-2">
                            <input
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                              type="text"
                              value={processingDelayHighThreshold}
                              onChange={(e) => setProcessingDelayHighThreshold(e.target.value)}
                            />
                            <select
                              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                              value={processingDelayHighUnit}
                              onChange={(e) => setProcessingDelayHighUnit(e.target.value)}
                            >
                              <option value="seconds">seconds</option>
                              <option value="milliseconds">milliseconds</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Congestion Threshold Section */}
                <div className="mt-8">
                  <div 
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded-lg border border-gray-200"
                    onClick={() => setShowCongestionThreshold(!showCongestionThreshold)}
                  >
                    <h4 className="text-lg font-bold text-gray-800">Congestion threshold</h4>
                    <span className="text-xl text-gray-400">
                      {showCongestionThreshold ? '−' : '+'}
                    </span>
                  </div>
                  
                  {showCongestionThreshold && (
                    <div className="mt-4 space-y-6 p-4 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Number of calls per period */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">Number of calls per period</label>
                          <input
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                            type="text"
                            value={nbCallsPerPeriod}
                            onChange={(e) => setNbCallsPerPeriod(e.target.value)}
                          />
                        </div>

                        {/* Period duration */}
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-gray-700">Period duration</label>
                          <div className="flex space-x-2">
                            <input
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white"
                              type="text"
                              value={periodDuration}
                              onChange={(e) => setPeriodDuration(e.target.value)}
                            />
                            <select
                              className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white cursor-pointer"
                              value={periodDurationUnit}
                              onChange={(e) => setPeriodDurationUnit(e.target.value)}
                            >
                              <option value="days">days</option>
                              <option value="hours">hours</option>
                              <option value="minutes">minutes</option>
                              <option value="seconds">seconds</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SIP Transport Servers Section */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="flex items-center justify-center mb-6">
            <span className="text-3xl mr-3">🖥️</span>
            <h3 className="text-2xl font-bold text-gray-800">SIP Transport Servers</h3>
          </div>
          
          <div className="space-y-6">
            {/* Current SIP Servers */}
            <div className="space-y-3">
              <h4 className="text-lg font-semibold text-gray-700">Current Servers</h4>
              <div className="border border-gray-200 rounded-lg min-h-[100px] p-4 bg-gray-50">
                {selectedSipServers.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No SIP servers selected</p>
                ) : (
                  <div className="space-y-2">
                    {selectedSipServers.map((server) => (
                      <div key={server.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                        <span className="font-medium text-gray-800">{server.name}</span>
                        <button
                          onClick={() => {
                            setSelectedSipServers(prev => prev.filter(s => s.id !== server.id));
                          }}
                          className="text-red-600 hover:text-red-800 font-medium text-sm"
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
              <h4 className="text-lg font-semibold text-gray-700">Available Servers</h4>
              <div className="flex space-x-4">
                <select
                  multiple
                  size="5"
                  className="flex-1 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-3 bg-white"
                  value={[]}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions);
                    selectedOptions.forEach(option => {
                      const server = availableSipServers.find(s => s.id === option.value);
                      if (server && !selectedSipServers.find(s => s.id === server.id)) {
                        setSelectedSipServers(prev => [...prev, server]);
                      }
                    });
                  }}
                >
                  {availableSipServers
                    .filter(server => !selectedSipServers.find(s => s.id === server.id))
                    .map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                </select>
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      // This would be handled by the select onChange above
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ←
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* VOIP Media (Port Range) Section */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="flex items-center justify-center mb-6">
            <span className="text-3xl mr-3">🔌</span>
            <h3 className="text-2xl font-bold text-gray-800">VOIP Media Only (Port Range)</h3>
          </div>
          
          <div className="space-y-6">
            {/* Current Port Ranges */}
            <div className="space-y-3">
              <h4 className="text-lg font-semibold text-gray-700">Current Port Ranges</h4>
              <div className="border border-gray-200 rounded-lg min-h-[100px] p-4 bg-gray-50">
                {selectedPortRanges.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No port ranges selected</p>
                ) : (
                  <div className="space-y-2">
                    {selectedPortRanges.map((range) => (
                      <div key={range.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
                        <span className="font-medium text-gray-800">{range.name}</span>
                        <button
                          onClick={() => {
                            setSelectedPortRanges(prev => prev.filter(r => r.id !== range.id));
                          }}
                          className="text-red-600 hover:text-red-800 font-medium text-sm"
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
              <h4 className="text-lg font-semibold text-gray-700">Available Port Ranges</h4>
              <div className="flex space-x-4">
                <select
                  multiple
                  size="5"
                  className="flex-1 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 p-3 bg-white"
                  value={[]}
                  onChange={(e) => {
                    const selectedOptions = Array.from(e.target.selectedOptions);
                    selectedOptions.forEach(option => {
                      const range = availablePortRanges.find(r => r.id === option.value);
                      if (range && !selectedPortRanges.find(r => r.id === range.id)) {
                        setSelectedPortRanges(prev => [...prev, range]);
                      }
                    });
                  }}
                >
                  {availablePortRanges
                    .filter(range => !selectedPortRanges.find(r => r.id === range.id))
                    .map((range) => (
                      <option key={range.id} value={range.id}>
                        {range.name}
                      </option>
                    ))}
                </select>
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      // This would be handled by the select onChange above
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ←
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <span className="text-3xl mr-3">🎯</span>
              <h3 className="text-2xl font-bold text-gray-800">Actions</h3>
            </div>
            <p className="text-gray-600">Choose an action to perform with your NAP configuration</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <button 
              className={`px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 ${
                isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 shadow-lg hover:shadow-xl'
              }`}
              onClick={() => handleCreateNAP('full')}
              disabled={isLoading}
              title="Create NAP with complete configuration from form"
            >
              <span className="text-xl">
                {isDuplicateChecking ? "🔍" : isLoading ? "⚙️" : "🚀"}
              </span>
              <span>
                {isDuplicateChecking ? "Checking..." : isLoading ? "Creating..." : "Full Config"}
              </span>
            </button>
            
            <button 
              className={`px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 ${
                isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transform hover:scale-105 shadow-lg hover:shadow-xl'
              }`}
              onClick={() => handleCreateNAP('proxy')}
              disabled={isLoading}
              title="Create NAP with SIP proxy configuration"
            >
              <span className="text-xl">
                {isDuplicateChecking ? "🔍" : isLoading ? "📡" : "📡"}
              </span>
              <span>
                {isDuplicateChecking ? "Checking..." : isLoading ? "Creating..." : "SIP Proxy"}
              </span>
            </button>
            
            <button 
              className={`px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 ${
                isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 transform hover:scale-105 shadow-lg hover:shadow-xl'
              }`}
              onClick={() => handleCreateNAP('simple')}
              disabled={isLoading}
              title="Create simple NAP with name only (fastest)"
            >
              <span className="text-xl">
                {isDuplicateChecking ? "🔍" : isLoading ? "⚡" : "⚡"}
              </span>
              <span>
                {isDuplicateChecking ? "Checking..." : isLoading ? "Creating..." : "Simple"}
              </span>
            </button>
            
            <button 
              className={`px-6 py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center justify-center space-x-2 ${
                isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transform hover:scale-105 shadow-lg hover:shadow-xl'
              }`}
              onClick={handleCheckExistingNaps}
              disabled={isLoading}
              title="Check existing NAPs in ProSBC"
            >
              <span className="text-xl">📋</span>
              <span>
                {isLoading && !isDuplicateChecking ? "Fetching..." : "Check NAPs"}
              </span>
            </button>
          </div>
          
          {message && (
            <div className={`p-6 rounded-xl border font-mono text-sm leading-relaxed whitespace-pre-line ${getMessageClasses()}`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NapCreator;
