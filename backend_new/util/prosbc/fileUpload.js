// Utility for uploading DF and DM files to ProSBC via HTTP (manual process automation)
// This module will provide functions to upload files to the ProSBC web endpoints using axios

const axios = require('axios');
const FormData = require('form-data');

/**
 * Upload a DF file to ProSBC
 * @param {Buffer|Stream} fileBuffer - The file data
 * @param {string} fileName - The file name
 * @param {string} sessionCookie - The _WebOAMP_session cookie value
 * @param {string} baseUrl - The base URL, e.g. https://prosbc2tpa2.dipvtel.com:12358
 * @returns {Promise<object>} Result of upload
 */
async function uploadDfFileToProSBC(fileBuffer, fileName, sessionCookie, baseUrl) {
  const url = `${baseUrl}/file_dbs/1/routesets_definitions`;
  const form = new FormData();
  form.append('file', fileBuffer, fileName);

  try {
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        Cookie: `_WebOAMP_session=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 0, // To capture 302
      validateStatus: status => status === 302 || status === 200 || status === 400 || status === 409,
    });
    return { success: response.status === 302, status: response.status, headers: response.headers };
  } catch (error) {
    return { success: false, error: error.message, details: error.response?.data };
  }
}

/**
 * Upload a DM file to ProSBC
 * @param {Buffer|Stream} fileBuffer - The file data
 * @param {string} fileName - The file name
 * @param {string} sessionCookie - The _WebOAMP_session cookie value
 * @param {string} baseUrl - The base URL, e.g. https://prosbc2tpa2.dipvtel.com:12358
 * @returns {Promise<object>} Result of upload
 */
async function uploadDmFileToProSBC(fileBuffer, fileName, sessionCookie, baseUrl) {
  const url = `${baseUrl}/file_dbs/1/routesets_digitmaps`;
  const form = new FormData();
  form.append('file', fileBuffer, fileName);

  try {
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        Cookie: `_WebOAMP_session=${sessionCookie}`,
        'User-Agent': 'Mozilla/5.0 (compatible; ProSBC-Automation)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 0, // To capture 302
      validateStatus: status => status === 302 || status === 200 || status === 400 || status === 409,
    });
    return { success: response.status === 302, status: response.status, headers: response.headers };
  } catch (error) {
    return { success: false, error: error.message, details: error.response?.data };
  }
}

module.exports = {
  uploadDfFileToProSBC,
  uploadDmFileToProSBC,
};
