// ========================================
// API Environment Configuration
// ========================================

/**
 * Retrieves the backend API base URL from Vite's environment variables.
 *
 * Centralizing this value prevents individual service modules from reading
 * environment variables directly. Future API services can import the same
 * configuration, which keeps environment handling consistent throughout the
 * frontend application.
 *
 * Local development currently uses:
 * http://localhost:3001
 *
 * Production deployments can provide a different `VITE_API_BASE_URL` value
 * without requiring any source-code changes.
 */
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

/**
 * Verifies that the required API environment variable was provided.
 *
 * Failing immediately with a descriptive message is preferable to allowing
 * requests to use an invalid URL such as `undefined/api/analyze`, which would
 * make configuration problems more difficult to diagnose.
 */
if (!rawApiBaseUrl) {
  throw new Error(
    "VITE_API_BASE_URL is not configured. Add it to the frontend environment file."
  );
}

/**
 * Removes trailing slashes from the configured base URL.
 *
 * Normalizing the value here prevents malformed URLs containing duplicate
 * slashes when service modules append endpoint paths.
 *
 * Example:
 * http://localhost:3001/ becomes http://localhost:3001
 */
const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");

// ========================================
// API Endpoint Configuration
// ========================================

/**
 * Provides centralized endpoint paths for frontend API services.
 *
 * Keeping endpoint construction in this module ensures that route changes can
 * be made in one location rather than across multiple components and services.
 */
const API_ENDPOINTS = {
  analyzeRequirements: `${API_BASE_URL}/api/analyze`,
};

export {
  API_BASE_URL,
  API_ENDPOINTS,
};