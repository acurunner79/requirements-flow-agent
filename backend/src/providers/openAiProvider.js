// ========================================
// OpenAI SDK Dependency
// ========================================

const OpenAI = require("openai");

// ========================================
// OpenAI Environment Configuration
// ========================================

/**
 * Reads the server-side OpenAI configuration from environment variables.
 *
 * These values must remain on the backend. They must never be exposed through
 * React environment variables, API responses, browser code, or source control.
 *
 * Required configuration:
 * - OPENAI_API_KEY: Secret API credential for the approved OpenAI project
 * - OPENAI_MODEL: Model identifier approved for requirements analysis
 *
 * Optional configuration:
 * - OPENAI_MAX_OUTPUT_TOKENS: Maximum number of output tokens requested from
 *   the model
 */
const configuredApiKey = process.env.OPENAI_API_KEY
  ? process.env.OPENAI_API_KEY.trim()
  : "";

const configuredModel = process.env.OPENAI_MODEL
  ? process.env.OPENAI_MODEL.trim()
  : "";

const configuredMaxOutputTokens =
  process.env.OPENAI_MAX_OUTPUT_TOKENS
    ? Number.parseInt(
        process.env.OPENAI_MAX_OUTPUT_TOKENS,
        10
      )
    : 6000;

const configuredTimeoutMs =
  process.env.OPENAI_TIMEOUT_MS
    ? Number.parseInt(
        process.env.OPENAI_TIMEOUT_MS,
        10
      )
    : 60_000;

const configuredMaxRetries =
  process.env.OPENAI_MAX_RETRIES
    ? Number.parseInt(
        process.env.OPENAI_MAX_RETRIES,
        10
      )
    : 2;

// ========================================
// OpenAI Configuration Validation
// ========================================

/**
 * Validates all configuration required by the OpenAI provider adapter.
 *
 * Configuration is checked when the adapter is invoked rather than when the
 * module is imported. This allows the application to continue running in mock
 * mode without requiring OpenAI credentials.
 *
 * @returns {void}
 *
 * @throws {Error}
 * Throws a descriptive configuration error when a required environment value
 * is missing or invalid.
 */
const validateOpenAiConfiguration = () => {
  if (!configuredApiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured on the backend server."
    );
  }

  if (!configuredModel) {
    throw new Error(
      "OPENAI_MODEL is not configured on the backend server."
    );
  }

  if (
    !Number.isInteger(configuredMaxOutputTokens) ||
    configuredMaxOutputTokens <= 0
  ) {
    throw new Error(
      "OPENAI_MAX_OUTPUT_TOKENS must be a positive integer."
    );
  }

  if (
    !Number.isInteger(configuredTimeoutMs) ||
    configuredTimeoutMs <= 0
  ) {
    throw new Error(
      "OPENAI_TIMEOUT_MS must be a positive integer."
    );
  }

  if (
    !Number.isInteger(configuredMaxRetries) ||
    configuredMaxRetries < 0
  ) {
    throw new Error(
      "OPENAI_MAX_RETRIES must be a non-negative integer."
    );
  }
};

// ========================================
// OpenAI Client Factory
// ========================================

/**
 * Creates an authenticated OpenAI SDK client.
 *
 * Client creation remains isolated in a factory so initialization can later be
 * extended with organization settings, project identifiers, request timeouts,
 * retry policies, or an enterprise API gateway without changing the analysis
 * function.
 *
 * @returns {OpenAI}
 * Authenticated OpenAI SDK client.
 */
const createOpenAiClient = () => {
  validateOpenAiConfiguration();

  return new OpenAI({
    apiKey: configuredApiKey,
    timeout: configuredTimeoutMs,
    maxRetries: configuredMaxRetries,
  });
};

// ========================================
// OpenAI Response Extraction
// ========================================

/**
 * Extracts the final text output from an OpenAI Responses API result.
 *
 * The SDK exposes the combined generated text through `output_text`. Keeping
 * extraction logic in a separate helper makes provider-response handling
 * independently testable and gives us one location to support alternate
 * response structures later.
 *
 * @param {object} response
 * Response object returned by the OpenAI SDK.
 *
 * @returns {string}
 * Trimmed model-generated response text.
 *
 * @throws {Error}
 * Throws when the API response does not contain usable generated text.
 */
const extractOpenAiResponseText = (response) => {
  if (
    !response ||
    typeof response.output_text !== "string" ||
    !response.output_text.trim()
  ) {
    throw new Error(
      "OpenAI returned a response without usable process-model content."
    );
  }

  return response.output_text.trim();
};

// ========================================
// OpenAI Process Analysis
// ========================================

/**
 * Submits a provider-neutral process-analysis prompt to OpenAI.
 *
 * This adapter is responsible only for OpenAI-specific concerns:
 * - Authenticating with the official SDK
 * - Selecting the configured model
 * - Constructing the Responses API request
 * - Extracting the generated text
 * - Translating provider errors into useful backend errors
 *
 * Prompt construction, JSON parsing, process normalization, frontend review,
 * validation, and file export remain outside this adapter.
 *
 * @param {string} prompt
 * Complete process-analysis instruction generated by the shared prompt utility.
 *
 * @returns {Promise<string>}
 * Raw JSON text generated by the configured OpenAI model.
 *
 * @throws {Error}
 * Throws when the prompt is invalid, configuration is missing, the API request
 * fails, or the response contains no usable text.
 */
const analyzeWithOpenAi = async (prompt) => {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error(
      "A valid process-analysis prompt is required for OpenAI."
    );
  }

  const openAiClient = createOpenAiClient();

  try {
    /**
     * The prompt already contains the complete business-analysis role,
     * extraction rules, response contract, and source requirements.
     *
     * `store: false` prevents this application request from being stored for
     * later retrieval through the Responses API.
     */
    const response = await openAiClient.responses.create({
      model: configuredModel,
      input: prompt.trim(),
      max_output_tokens: configuredMaxOutputTokens,
      store: false,
    });

    return extractOpenAiResponseText(response);
  } catch (error) {
    /**
     * Preserve configuration and adapter-generated errors because they already
     * contain actionable diagnostic information.
     */
    if (
      error instanceof Error &&
      (
        error.message.startsWith("OPENAI_") ||
        error.message.startsWith("OpenAI returned") ||
        error.message.startsWith(
          "A valid process-analysis prompt"
        )
      )
    ) {
      throw error;
    }

    /**
     * Convert SDK failures into a provider-specific service error without
     * exposing API keys, request headers, or complete provider response data.
     *
     * The original SDK message is included during development because it can
     * identify billing, authentication, model-access, rate-limit, and request
     * configuration problems.
     */
    const providerMessage =
      error instanceof Error && error.message
        ? error.message
        : "Unknown OpenAI API error.";

    throw new Error(
      `OpenAI process analysis failed: ${providerMessage}`
    );
  }
};

module.exports = {
  analyzeWithOpenAi,
  createOpenAiClient,
  extractOpenAiResponseText,
  validateOpenAiConfiguration,
};