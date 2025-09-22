import NapEditService from './napEditService.js';
import { JSDOM } from 'jsdom';

// Fetch NAP list from ProSBC and return array of { id, name }
export async function fetchProSbcNapList() {
  const napService = new NapEditService();
  const baseUrl = napService.baseUrl;
  const listUrl = `${baseUrl}/naps`;
  const response = await napService.makeRequest(listUrl, { method: 'GET' });
  if (!response.ok) throw new Error('Failed to fetch NAP list from ProSBC');
  const html = await response.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  // ProSBC NAPs are in a table with links like /naps/{id}/edit
  const napRows = Array.from(doc.querySelectorAll('a.edit_link[href^="/naps/"]'));
  const naps = napRows.map(link => {
    const href = link.getAttribute('href');
    const match = href.match(/\/naps\/(\d+)\/edit/);
    if (!match) return null;
    return {
      id: match[1],
      name: link.textContent.trim()
    };
  }).filter(Boolean);
  // Log the fetched NAP names for debugging
  console.log('[ProSBC] Fetched NAPs:', naps.map(n => n.name));
  return naps;
}

// Utility to get NAP ID from ProSBC by name or ID
export async function getProSbcNapIdByNameOrId(identifier) {
  if (/^\d+$/.test(identifier)) return identifier;
  const napList = await fetchProSbcNapList();
  const nap = napList.find(n => n.name === identifier);
  if (!nap) throw new Error('NAP not found in ProSBC for identifier: ' + identifier);
  return nap.id;
}
