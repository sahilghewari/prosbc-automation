// Helper functions for ID mappings
const getProfileId = (profileName) => {
  const profiles = {
    'asterisk': 2,
    'default': 1,
    'freeswitch': 3
  };
  return profiles[profileName] || 1;
};

const getNatMethodId = (method) => {
  const methods = {
    'None': 0,
    'Force Passive Mode': 1,
    'Parse Direction Attribute': 2
  };
  return methods[method] || 0;
};

const getSipNatMethodId = (method) => {
  const methods = {
    'None': 0,
    'Automatic NAT traversal': 1,
    'Force Use of Public IP/Port or FQDN': 2
  };
  return methods[method] || 0;
};

const getIsupVariantId = (variant) => {
  const variants = {
    'ANSI88': 1,
    'ANSI92': 2,
    'ANSI95': 3,
    'TELCORDIA': 4,
    'ITU': 5,
    'ITU97': 6,
    'SINGAPORE': 7,
    'Q767': 8,
    'NTT': 9,
    'CHINA': 10,
    'ETSI': 11,
    'ETSIV3': 12,
    'UK': 13,
    'SPIROU': 14,
    'RUSSIA': 15
  };
  return variants[variant] || 5;
};

const getCallProgressMethodId = (method) => {
  const methods = {
    '183 Call Progress': 0,
    'SIP_INFO': 1
  };
  return methods[method] || 0;
};

const getPrivacyTypeId = (type) => {
  const types = {
    'None': 1,
    'Remote-Party-Id': 2,
    'P-Asserted-Identity': 3,
    'Both': 4
  };
  return types[type] || 3;
};

const convertTimeToMs = (value, unit) => {
  const multipliers = {
    'milliseconds': 1,
    'seconds': 1000,
    'minutes': 60000
  };
  return parseFloat(value) * (multipliers[unit] || 1000);
};

const convertTimeToSeconds = (value, unit) => {
  const multipliers = {
    'seconds': 1,
    'minutes': 60,
    'hours': 3600,
    'days': 86400
  };
  return parseFloat(value) * (multipliers[unit] || 60);
};

// Helper function to format time values with units
const formatTimeWithUnit = (value, unit) => {
  return `${value} ${unit === 'minutes' ? 'minute' : unit === 'seconds' ? 'second' : 'millisecond'}${value !== '1' ? 's' : ''}`;
};

// Optimized payload builder matching exact ProSBC API structure
export const buildOptimizedNapPayload = (formData) => {
  return {
    name: formData.napName,
    default_profile: formData.defaultProfile,
    enabled: formData.enabled,
    port_ranges: formData.selectedPortRanges ? formData.selectedPortRanges.map(r => r.name) : [],
    sip_transport_servers: formData.selectedSipServers ? formData.selectedSipServers.map(s => s.name) : [],
    sip_cfg: {
      sip_use_proxy: formData.sipUseProxy,
      proxy_address: formData.proxyAddress,
      proxy_port: parseInt(formData.proxyPort),
      proxy_port_type: "UDP",
      poll_remote_proxy: formData.pollRemoteProxy,
      proxy_polling_interval: formatTimeWithUnit(formData.proxyPollingInterval, formData.proxyPollingIntervalUnit),
      proxy_polling_max_forwards: parseInt(formData.proxyPollingMaxForwards),
      proxy_polling_response_timeout: formatTimeWithUnit(formData.responseTimeout, formData.responseTimeoutUnit),
      accept_only_authorized_users: formData.acceptOnlyAuthorizedUsers,
      nap_sip_acls: [],
      authentication_parameters: {
        ignore_realm: formData.ignoreRealm,
        reuse_challenge: formData.reuseChallenge,
        realm: formData.realm,
        user: formData.authUser,
        password: formData.authPassword,
        "***meta***": {
          valid_url: false
        }
      },
      registration_parameters: {
        register_to_proxy: formData.registerToProxy,
        address_to_register: formData.addressToRegister,
        "***meta***": {
          valid_url: false
        }
      },
      filtering_parameters: {
        filter_by_proxy_address: true,
        filter_by_proxy_port: formData.filterByProxyPort,
        filter_by_local_port: true,
        "***meta***": {
          valid_url: false
        }
      },
      sipi_parameters: {
        enable: formData.sipiEnable,
        append_f_to_outgoing_calls: formData.appendFToOutgoingCalls,
        content_type: formData.contentType,
        isup_protocol_variant: formData.isupProtocolVariant,
        call_progress_method: formData.callProgressMethod,
        "***meta***": {
          valid_url: false
        }
      },
      advanced_parameters: {
        privacy_type: formData.privacyType,
        map_any_response_to_available_status: formData.mapAnyResponseToAvailableStatus,
        "183_triggers_call_progress": formData.triggersCallProgress,
        response_timeout: formatTimeWithUnit(formData.responseTimeout, formData.responseTimeoutUnit),
        "***meta***": {
          valid_url: false
        }
      },
      network_address_translation: {
        remote_method_sip: formData.remoteMethodSip,
        remote_method_rtp: formData.remoteMethodRtp,
        local_method_sip: formData.localMethodSip,
        local_method_rtp: formData.localMethodRtp,
        "***meta***": {
          valid_url: false
        }
      },
      "***meta***": {
        valid_url: false
      }
    },
    call_rate_limiting: {
      maximum_calls_per_second: parseInt(formData.maxCallsPerSecond),
      maximum_incoming_calls_per_second: parseInt(formData.maxIncomingCallsPerSecond),
      maximum_outgoing_calls_per_second: parseInt(formData.maxOutgoingCallsPerSecond),
      maximum_simultaneous_total_calls: parseInt(formData.maxSimultaneousTotalCalls),
      maximum_simultaneous_incoming_calls: parseInt(formData.maxSimultaneousIncomingCalls),
      maximum_simultaneous_outgoing_calls: parseInt(formData.maxSimultaneousOutgoingCalls),
      processing_delay_low_threshold: formatTimeWithUnit(formData.processingDelayLowThreshold, formData.processingDelayLowUnit),
      processing_delay_high_threshold: formatTimeWithUnit(formData.processingDelayHighThreshold, formData.processingDelayHighUnit),
      "***meta***": {
        valid_url: false
      }
    },
    congestion_threshold: {
      period_duration: formatTimeWithUnit(formData.periodDuration, formData.periodDurationUnit),
      nb_calls_per_period: parseInt(formData.nbCallsPerPeriod),
      "***meta***": {
        valid_url: false
      }
    },
    "***meta***": {
      version: "3.1.147.16",
      src_path: ""
    }
  };
};

// Minimal payload for testing - matching exact ProSBC structure
export const buildMinimalNapPayload = (napName) => {
  return {
    name: napName,
    default_profile: "default",
    enabled: true,
    port_ranges: [],
    sip_transport_servers: [],
    sip_cfg: {
      sip_use_proxy: true,
      proxy_address: "69.87.154.10",
      proxy_port: 5060,
      proxy_port_type: "UDP",
      poll_remote_proxy: true,
      proxy_polling_interval: "1 minute",
      proxy_polling_max_forwards: 1,
      proxy_polling_response_timeout: "12 seconds",
      accept_only_authorized_users: false,
      nap_sip_acls: [],
      authentication_parameters: {
        ignore_realm: false,
        reuse_challenge: false,
        realm: "",
        user: "",
        password: "",
        "***meta***": {
          valid_url: false
        }
      },
      registration_parameters: {
        register_to_proxy: false,
        address_to_register: "",
        "***meta***": {
          valid_url: false
        }
      },
      filtering_parameters: {
        filter_by_proxy_address: true,
        filter_by_proxy_port: true,
        filter_by_local_port: true,
        "***meta***": {
          valid_url: false
        }
      },
      sipi_parameters: {
        enable: false,
        append_f_to_outgoing_calls: false,
        content_type: "itu-t",
        isup_protocol_variant: "ITU",
        call_progress_method: "183 Call Progress",
        "***meta***": {
          valid_url: false
        }
      },
      advanced_parameters: {
        privacy_type: "P-Asserted-Identity",
        map_any_response_to_available_status: true,
        "183_triggers_call_progress": false,
        response_timeout: "12 seconds",
        "***meta***": {
          valid_url: false
        }
      },
      network_address_translation: {
        remote_method_sip: "None",
        remote_method_rtp: "None",
        local_method_sip: "",
        local_method_rtp: "",
        "***meta***": {
          valid_url: false
        }
      },
      "***meta***": {
        valid_url: false
      }
    },
    call_rate_limiting: {
      maximum_calls_per_second: 0,
      maximum_incoming_calls_per_second: 0,
      maximum_outgoing_calls_per_second: 0,
      maximum_simultaneous_total_calls: 0,
      maximum_simultaneous_incoming_calls: 0,
      maximum_simultaneous_outgoing_calls: 0,
      processing_delay_low_threshold: "3 seconds",
      processing_delay_high_threshold: "6 seconds",
      "***meta***": {
        valid_url: false
      }
    },
    congestion_threshold: {
      period_duration: "1 minute",
      nb_calls_per_period: 1,
      "***meta***": {
        valid_url: false
      }
    },
    "***meta***": {
      version: "3.1.147.16",
      src_path: ""
    }
  };
};
