// ========================================
// Requirements Analysis API Configuration
// ========================================

/**
 * Reads the backend base URL from Vite's environment configuration.
 *
 * Local development uses the value stored in `frontend/.env`. Deployment
 * environments can provide a different value without requiring source-code
 * changes.
 *
 * `VITE_API_BASE_URL` must include the protocol and host, but it should not
 * include a trailing slash.
 *
 * Example:
 * http://localhost:3001
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Defines the complete endpoint used to submit business requirements for
 * analysis.
 *
 * Building the endpoint from a shared base URL allows future frontend services
 * to reuse the same API host while supplying their own route paths.
 */
const ANALYZE_REQUIREMENTS_URL = `${API_BASE_URL}/api/analyze`;

// ========================================
// Requirements Analysis API Service
// ========================================

/**
 * Sends business-requirements text to the backend and returns the generated
 * process model.
 *
 * This service isolates HTTP communication from React components. Components
 * remain focused on user interaction and rendering, while request setup,
 * response parsing, and API error handling stay centralized and reusable.
 *
 * @param {string} requirements
 * The validated business-requirements text to analyze.
 *
 * @returns {Promise<object>}
 * The structured process model returned by the backend.
 *
 * @throws {Error}
 * Throws a descriptive error when the request fails, the API returns an
 * unsuccessful status, or the response cannot be processed.
 */
const analyzeRequirements = async (requirements) => {
  const response = await fetch(ANALYZE_REQUIREMENTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requirements,
    }),
  });

  /**
   * Parse the JSON response before evaluating the HTTP status because the
   * backend includes useful validation and server-error messages in its JSON
   * response body.
   */
  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(
      responseData.error || "The requirements could not be analyzed."
    );
  }

  return responseData;
};

export {
  analyzeRequirements,
};