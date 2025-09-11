import NAP from '../../models/NAP.js';

// Utility to get NAP by name or ID
export async function getNapIdByNameOrId(identifier) {
  // If identifier is numeric, treat as ID
  if (/^\d+$/.test(identifier)) {
    return parseInt(identifier, 10);
  }
  // Otherwise, look up by name
  const nap = await NAP.findOne({ where: { name: identifier } });
  if (!nap) throw new Error('NAP not found for identifier: ' + identifier);
  return nap.id;
}
