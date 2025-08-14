// Enhanced and Ultra-optimized ProSBC utilities index
export { sessionPool } from './sessionPool.js';
export { configCache } from './configCache.js';
export { connectionPool } from './connectionPool.js';
export { htmlParser } from './htmlParser.js';
export { OptimizedProSBCFileAPI } from './optimizedFileManager.js';

// Enhanced versions (addresses specific parsing and config issues)
export { enhancedSwitcher } from './enhancedSwitcher.js';
export { createEnhancedProSBCFileAPI } from './enhancedFileAPI.js';

// Hyper-optimized versions (MINIMAL endpoint calls after switching)
export { hyperOptimizedSwitcher } from './hyperOptimizedSwitcher.js';
export { createHyperOptimizedProSBCFileAPI } from './hyperOptimizedFileAPI.js';

// Ultra-optimized components (85-90% fewer API calls)
export { ultraOptimizedSwitcher } from './ultraOptimizedSwitcher.js';
export { UltraOptimizedProSBCFileAPI, createUltraOptimizedProSBCFileAPI } from './ultraOptimizedFileAPI.js';

// Default export - use hyper-optimized version for MINIMAL endpoint calls
import { createHyperOptimizedProSBCFileAPI } from './hyperOptimizedFileAPI.js';
export default createHyperOptimizedProSBCFileAPI;
