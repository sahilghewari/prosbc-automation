// Utility for uploading DF and DM files to ProSBC via HTTP (manual process automation)
// This module will provide functions to upload files to the ProSBC web endpoints using axios

import axios from 'axios';
import FormData from 'form-data';
import { getInstanceContext } from './multiInstanceManager.js';

/**
 * Upload a DF file to ProSBC
 * @param {Buffer|Stream} fileBuffer - The file data
 * @param {string} fileName - The file name
 * @param {string} sessionCookie - The _WebOAMP_session cookie value
 * @param {string} baseUrl - The base URL (optional if instanceId provided)
 * @param {number} instanceId - ProSBC instance ID (optional if baseUrl provided)
 * @returns {Promise<object>} Result of upload
 */
async function uploadDfFileToProSBC(fileBuffer, fileName, sessionCookie, baseUrl = null, instanceId = null) {
  let resolvedBaseUrl = baseUrl;
  
  // If instanceId provided, get baseUrl from instance context
  if (instanceId && !baseUrl) {
    const instanceContext = await getInstanceContext(instanceId);
    resolvedBaseUrl = instanceContext.baseUrl;
    console.log(`[DF Upload] Using instance ${instanceContext.name}: ${resolvedBaseUrl}`);
  } else if (!resolvedBaseUrl) {
    resolvedBaseUrl = process.env.PROSBC_BASE_URL;
  }
  
  if (!resolvedBaseUrl) {
    throw new Error('ProSBC base URL is not defined. Provide baseUrl parameter, instanceId, or set PROSBC_BASE_URL in environment variables.');
  }
  const url = `${resolvedBaseUrl}/file_dbs/1/routesets_definitions`;
  const uploadFormUrl = `${resolvedBaseUrl}/file_dbs/1/routesets_definitions/new`;
  // Step 1: Fetch upload form page to get authenticity_token and tbgw_files_db_id
  let authenticityToken = null;
  let tbgwFilesDbId = null;
  try {
    const uploadPageResp = await axios.get(uploadFormUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: `_WebOAMP_session=${sessionCookie}`,
      },
      maxRedirects: 0,
      validateStatus: status => status === 200,
    });
    console.debug('[ProSBC DF Upload] GET upload form response:', {
      status: uploadPageResp.status,
      headers: uploadPageResp.headers,
      data: typeof uploadPageResp.data === 'string' ? uploadPageResp.data.substring(0, 1000) : uploadPageResp.data
    });
    // Extract authenticity_token
    const tokenMatch = uploadPageResp.data.match(/name="authenticity_token" type="hidden" value="([^"]+)"/);
    if (tokenMatch) {
      authenticityToken = tokenMatch[1];
    } else {
      throw new Error('authenticity_token not found in upload page');
    }
    // Extract tbgw_files_db_id (hidden field)
    const dbIdMatch = uploadPageResp.data.match(/name="tbgw_routesets_definition\[tbgw_files_db_id\]" type="hidden" value="(\d+)"/);
    if (dbIdMatch) {
      tbgwFilesDbId = dbIdMatch[1];
    } else {
      throw new Error('tbgw_files_db_id not found in upload page');
    }
    console.debug('[ProSBC DF Upload] Extracted fields:', { authenticityToken, tbgwFilesDbId });
  } catch (err) {
    console.error('[ProSBC DF Upload] Failed to fetch upload page or extract fields:', err.message);
    return { success: false, error: err.message };
  }


  // Step 2: POST file with all required fields (match browser form exactly)
  const form = new FormData();
  form.append('authenticity_token', authenticityToken);
  form.append('tbgw_routesets_definition[file]', fileBuffer, fileName);
  form.append('tbgw_routesets_definition[tbgw_files_db_id]', tbgwFilesDbId);
  form.append('commit', 'Import');

  console.debug('[ProSBC DF Upload] POST form fields:', form.getBuffer().toString('utf8', 0, 1000));

  try {
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        Cookie: `_WebOAMP_session=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: uploadFormUrl,
        Origin: resolvedBaseUrl,
      },
      maxRedirects: 0, // To capture 302
      validateStatus: status => status === 302 || status === 200 || status === 400 || status === 409,
    });
    console.debug('[ProSBC DF Upload] POST response:', {
      status: response.status,
      headers: response.headers,
      data: typeof response.data === 'string' ? response.data.substring(0, 1000) : response.data
    });
    if (response.status !== 302) {
      console.error('[ProSBC DF Upload] Unexpected response:', {
        status: response.status,
        headers: response.headers,
        data: response.data && typeof response.data === 'string' ? response.data.substring(0, 1000) : response.data
      });
    }
    return { success: response.status === 302, status: response.status, headers: response.headers, data: response.data };
  } catch (error) {
    console.error('[ProSBC DF Upload] Error:', error.message, error.response?.data);
    return { success: false, error: error.message, details: error.response?.data };
  }
}

/**
 * Upload a DM file to ProSBC
 * @param {Buffer|Stream} fileBuffer - The file data
 * @param {string} fileName - The file name
 * @param {string} sessionCookie - The _WebOAMP_session cookie value
 * @param {string} baseUrl - The base URL (optional if instanceId provided)
 * @param {number} instanceId - ProSBC instance ID (optional if baseUrl provided)
 * @returns {Promise<object>} Result of upload
 */
async function uploadDmFileToProSBC(fileBuffer, fileName, sessionCookie, baseUrl = null, instanceId = null) {
  let resolvedBaseUrl = baseUrl;
  
  // If instanceId provided, get baseUrl from instance context
  if (instanceId && !baseUrl) {
    const instanceContext = await getInstanceContext(instanceId);
    resolvedBaseUrl = instanceContext.baseUrl;
    console.log(`[DM Upload] Using instance ${instanceContext.name}: ${resolvedBaseUrl}`);
  } else if (!resolvedBaseUrl) {
    resolvedBaseUrl = process.env.PROSBC_BASE_URL;
  }
  
  if (!resolvedBaseUrl) {
    throw new Error('ProSBC base URL is not defined. Provide baseUrl parameter, instanceId, or set PROSBC_BASE_URL in environment variables.');
  }
  const url = `${resolvedBaseUrl}/file_dbs/1/routesets_digitmaps`;
  const uploadFormUrl = `${resolvedBaseUrl}/file_dbs/1/routesets_digitmaps/new`;
  // Step 1: Fetch upload form page to get authenticity_token and tbgw_files_db_id
  let authenticityToken = null;
  let tbgwFilesDbId = null;
  try {
    const uploadPageResp = await axios.get(uploadFormUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: `_WebOAMP_session=${sessionCookie}`,
      },
      maxRedirects: 0,
      validateStatus: status => status === 200,
    });
    console.debug('[ProSBC DM Upload] GET upload form response:', {
      status: uploadPageResp.status,
      headers: uploadPageResp.headers,
      data: typeof uploadPageResp.data === 'string' ? uploadPageResp.data.substring(0, 1000) : uploadPageResp.data
    });
    // Extract authenticity_token
    const tokenMatch = uploadPageResp.data.match(/name="authenticity_token" type="hidden" value="([^"]+)"/);
    if (tokenMatch) {
      authenticityToken = tokenMatch[1];
    } else {
      throw new Error('authenticity_token not found in upload page');
    }
    // Extract tbgw_files_db_id (hidden field)
    const dbIdMatch = uploadPageResp.data.match(/name="tbgw_routesets_digitmap\[tbgw_files_db_id\]" type="hidden" value="(\d+)"/);
    if (dbIdMatch) {
      tbgwFilesDbId = dbIdMatch[1];
    } else {
      throw new Error('tbgw_files_db_id not found in upload page');
    }
    console.debug('[ProSBC DM Upload] Extracted fields:', { authenticityToken, tbgwFilesDbId });
  } catch (err) {
    console.error('[ProSBC DM Upload] Failed to fetch upload page or extract fields:', err.message);
    return { success: false, error: err.message };
  }


  // Step 2: POST file with all required fields (match browser form exactly)
  const form = new FormData();
  form.append('authenticity_token', authenticityToken);
  form.append('tbgw_routesets_digitmap[file]', fileBuffer, fileName);
  form.append('tbgw_routesets_digitmap[tbgw_files_db_id]', tbgwFilesDbId);
  form.append('commit', 'Import');

  console.debug('[ProSBC DM Upload] POST form fields:', form.getBuffer().toString('utf8', 0, 1000));

  try {
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        Cookie: `_WebOAMP_session=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Referer: uploadFormUrl,
        Origin: resolvedBaseUrl,
      },
      maxRedirects: 0, // To capture 302
      validateStatus: status => status === 302 || status === 200 || status === 400 || status === 409,
    });
    console.debug('[ProSBC DM Upload] POST response:', {
      status: response.status,
      headers: response.headers,
      data: typeof response.data === 'string' ? response.data.substring(0, 1000) : response.data
    });
    if (response.status !== 302) {
      console.error('[ProSBC DM Upload] Unexpected response:', {
        status: response.status,
        headers: response.headers,
        data: response.data && typeof response.data === 'string' ? response.data.substring(0, 1000) : response.data
      });
    }
    return { success: response.status === 302, status: response.status, headers: response.headers, data: response.data };
  } catch (error) {
    console.error('[ProSBC DM Upload] Error:', error.message, error.response?.data);
    return { success: false, error: error.message, details: error.response?.data };
  }
}

export { uploadDfFileToProSBC, uploadDmFileToProSBC };

// Helper functions for instance-based uploads
export async function uploadDfFileByInstanceId(fileBuffer, fileName, sessionCookie, instanceId) {
  return uploadDfFileToProSBC(fileBuffer, fileName, sessionCookie, null, instanceId);
}

export async function uploadDmFileByInstanceId(fileBuffer, fileName, sessionCookie, instanceId) {
  return uploadDmFileToProSBC(fileBuffer, fileName, sessionCookie, null, instanceId);
}
