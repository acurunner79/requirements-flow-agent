// ========================================
// AI Provider Dependencies
// ========================================

const {
  analyzeWithOpenAi,
} = require("../providers/openAiProvider");

// ========================================
// AI Provider Configuration
// ========================================

/**
 * Retrieves and normalizes the AI provider selected through the backend
 * environment configuration.
 *
 * Provider selection remains entirely server-side. Individual business
 * analysts use the application without supplying API keys, selecting personal
 * accounts, or configuring model endpoints.
 *
 * Examples:
 * AI_PROVIDER=openai
 * AI_PROVIDER=anthropic
 * AI_PROVIDER=ollama
 */
const getConfiguredAiProvider = () => {
  return process.env.AI_PROVIDER
    ? process.env.AI_PROVIDER.trim().toLowerCase()
    : "";
};

// ========================================
// AI Provider Constants
// ========================================

/**
 * Defines every provider identifier recognized by the application.
 *
 * Recognition means that the architecture reserves a stable configuration
 * value for the provider. It does not necessarily mean that the provider
 * adapter has already been implemented.
 */
const AI_PROVIDERS = {
  ANTHROPIC: "anthropic",
  OPENAI: "openai",
  AZURE_OPENAI: "azure-openai",
  OLLAMA: "ollama",
};

/**
 * Defines the provider adapters currently available for live analysis.
 *
 * OpenAI is the first implemented provider. Future adapters can be added here
 * after their request, authentication, and response-extraction modules have
 * been completed and tested.
 */
const IMPLEMENTED_AI_PROVIDERS = [
  AI_PROVIDERS.OPENAI,
];

// ========================================
// AI Provider Validation Helpers
// ========================================

/**
 * Returns every provider identifier recognized by the application.
 *
 * @returns {string[]}
 * Recognized provider identifiers.
 */
const getSupportedAiProviders = () => {
  return Object.values(AI_PROVIDERS);
};

/**
 * Determines whether a provider identifier is recognized.
 *
 * Comparisons are normalized to lowercase so environment values remain
 * consistent regardless of capitalization.
 *
 * @param {unknown} provider
 * Provider identifier to inspect.
 *
 * @returns {boolean}
 * True when the provider is recognized by the application.
 */
const isSupportedAiProvider = (provider) => {
  return (
    typeof provider === "string" &&
    getSupportedAiProviders().includes(
      provider.trim().toLowerCase()
    )
  );
};

/**
 * Determines whether a recognized provider currently has a completed adapter.
 *
 * @param {unknown} provider
 * Provider identifier to inspect.
 *
 * @returns {boolean}
 * True when the provider can currently handle live analysis requests.
 */
const isImplementedAiProvider = (provider) => {
  return (
    typeof provider === "string" &&
    IMPLEMENTED_AI_PROVIDERS.includes(
      provider.trim().toLowerCase()
    )
  );
};

/**
 * Validates the centrally configured AI provider.
 *
 * The validation distinguishes among:
 * - Missing configuration
 * - Unsupported provider identifiers
 * - Recognized providers whose adapters are not implemented
 *
 * This produces clearer deployment diagnostics than allowing an invalid value
 * to reach a provider SDK.
 *
 * @param {string} provider
 * Normalized provider identifier loaded from the server environment.
 *
 * @returns {void}
 *
 * @throws {Error}
 * Throws when the provider cannot currently be used.
 */
const validateAiProviderConfiguration = (provider) => {
  if (!provider) {
    throw new Error(
      "AI_PROVIDER is not configured on the backend server."
    );
  }

  if (!isSupportedAiProvider(provider)) {
    throw new Error(
      `Unsupported AI provider: ${provider}. Supported providers are: ${getSupportedAiProviders().join(
        ", "
      )}.`
    );
  }

  if (!isImplementedAiProvider(provider)) {
    throw new Error(
      `The ${provider} AI provider is recognized, but its adapter has not been implemented yet.`
    );
  }
};

// ========================================
// AI Provider Routing
// ========================================

/**
 * Routes a provider-neutral process-analysis prompt to the selected adapter.
 *
 * Provider routing is isolated in this function so the requirements-analysis
 * service never needs to import or understand provider-specific modules.
 *
 * Adding another provider later requires:
 * 1. Creating its adapter module
 * 2. Adding it to `IMPLEMENTED_AI_PROVIDERS`
 * 3. Adding one routing case below
 *
 * Controllers, routes, prompts, response normalization, frontend behavior, and
 * exports remain unchanged.
 *
 * @param {string} provider
 * Validated provider identifier.
 *
 * @param {string} prompt
 * Complete provider-neutral process-analysis prompt.
 *
 * @returns {Promise<string>}
 * Raw model response returned by the selected provider adapter.
 *
 * @throws {Error}
 * Throws when no routing implementation exists for the provider.
 */
const routePromptToProvider = async (provider, prompt) => {
  switch (provider) {
    case AI_PROVIDERS.OPENAI:
      return analyzeWithOpenAi(prompt);

    /**
     * Future provider adapters will follow this pattern:
     *
     * case AI_PROVIDERS.ANTHROPIC:
     *   return analyzeWithAnthropic(prompt);
     *
     * case AI_PROVIDERS.AZURE_OPENAI:
     *   return analyzeWithAzureOpenAi(prompt);
     *
     * case AI_PROVIDERS.OLLAMA:
     *   return analyzeWithOllama(prompt);
     */
    default:
      throw new Error(
        `No routing implementation is available for AI provider: ${provider}.`
      );
  }
};

// ========================================
// Provider-Independent Analysis Service
// ========================================

/**
 * Sends a process-analysis prompt to the centrally configured AI provider.
 *
 * This is the single provider-neutral entry point used by the requirements
 * analysis service.
 *
 * The workflow is:
 * 1. Read the current provider from the backend environment
 * 2. Validate that the provider is supported and implemented
 * 3. Route the prompt to the matching adapter
 * 4. Return the adapter's raw text response for normalization
 *
 * Provider configuration is retrieved when the function runs instead of when
 * this module is first imported. This makes configuration behavior easier to
 * test and avoids retaining an outdated value if the environment is loaded
 * before or during application startup.
 *
 * @param {string} prompt
 * Complete provider-neutral instruction generated by the prompt utility.
 *
 * @returns {Promise<string>}
 * Raw text returned by the configured AI provider.
 *
 * @throws {Error}
 * Throws when the prompt is invalid, provider configuration is unavailable, or
 * the selected provider request fails.
 */
const analyzeWithConfiguredProvider = async (prompt) => {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error(
      "A valid process-analysis prompt is required."
    );
  }

  const configuredProvider = getConfiguredAiProvider();

  validateAiProviderConfiguration(configuredProvider);

  return routePromptToProvider(
    configuredProvider,
    prompt.trim()
  );
};

module.exports = {
  AI_PROVIDERS,
  IMPLEMENTED_AI_PROVIDERS,
  analyzeWithConfiguredProvider,
  getConfiguredAiProvider,
  getSupportedAiProviders,
  isImplementedAiProvider,
  isSupportedAiProvider,
  routePromptToProvider,
  validateAiProviderConfiguration,
};