// ========================================
// Requirements Analysis API Configuration
// ========================================

/**
 * Reads and normalizes the backend base URL from Vite's environment
 * configuration.
 *
 * Local development can provide this value through `frontend/.env`.
 * Deployment platforms such as Netlify can provide the same variable through
 * their environment-variable settings.
 *
 * Removing trailing slashes prevents endpoint URLs such as:
 * https://api.example.com//api/analyze
 */
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || ""
).replace(/\/+$/, "");

/**
 * Returns the configured backend base URL or throws a clear configuration
 * error when the variable is missing.
 *
 * Failing before the request is sent produces a useful error instead of
 * attempting to fetch `undefined/api/analyze`.
 *
 * @returns {string}
 * Normalized backend base URL.
 *
 * @throws {Error}
 * Throws when VITE_API_BASE_URL is not configured.
 */
const getApiBaseUrl = () => {
  if (!API_BASE_URL) {
    throw new Error(
      "The frontend API URL is not configured. Set VITE_API_BASE_URL before running the application."
    );
  }

  return API_BASE_URL;
};

/**
 * Returns the complete requirements-analysis endpoint.
 *
 * The URL is resolved when the service is called so configuration failures are
 * surfaced through the application's existing error-handling workflow.
 *
 * @returns {string}
 * Complete backend analysis endpoint.
 */
const getAnalyzeRequirementsUrl = () => {
  return `${getApiBaseUrl()}/api/analyze`;
};

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
  const response = await fetch(
    getAnalyzeRequirementsUrl(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requirements,
      }),
    }
  );

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