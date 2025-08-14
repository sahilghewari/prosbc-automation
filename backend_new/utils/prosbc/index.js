// Index for ProSBC file management utilities
export * from './prosbcFileManager.js';
export * from './napEditService.js';
export * from './fileUpload.js';
export * from './napApiClientFixed.js';
export * from './multiInstanceManager.js';

// Export optimized utilities
export * from './optimized/index.js';
export { createProSBCFileAPI, CompatibilityProSBCFileAPI } from './optimized/migration.js';

// Export ultra-optimized utilities (85-90% fewer API calls)
export { createUltraOptimizedProSBCFileAPI, UltraOptimizedProSBCFileAPI } from './optimized/ultraOptimizedFileAPI.js';

// Default export - use ultra-optimized version by default
import { createUltraOptimizedProSBCFileAPI } from './optimized/ultraOptimizedFileAPI.js';
export default createUltraOptimizedProSBCFileAPI;

// Re-export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  const ProSBCFileAPI = require('./prosbcFileManager');
  const optimized = require('./optimized/index.js');
  
  module.exports = {
    ...ProSBCFileAPI,
    ...optimized,
    createUltraOptimizedProSBCFileAPI,
    default: createUltraOptimizedProSBCFileAPI
  };
}
