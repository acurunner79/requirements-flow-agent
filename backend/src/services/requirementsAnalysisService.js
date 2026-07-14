// ========================================
// Service Dependencies
// ========================================

const {
  analyzeWithConfiguredProvider,
} = require("./aiProviderService");
const {
  buildProcessAnalysisPrompt,
} = require("../utils/processPromptUtils");
const {
  processAiResponse,
} = require("../utils/processResponseUtils");
const {
  complexProcessModelFixture,
} = require("../fixtures/complexProcessModel");

// ========================================
// Requirements Analysis Configuration
// ========================================

/**
 * Defines the analysis mode used by the backend.
 *
 * Supported values:
 * - `mock`: Returns a deterministic sample process model without calling an AI
 *   provider. This keeps local development and interface testing available
 *   without requiring credentials.
 * - `ai`: Builds the process-analysis prompt, sends it to the centrally
 *   configured provider, and normalizes the returned process model.
 *
 * Mock mode remains available for deterministic, token-free regression testing.
 */
const configuredAnalysisMode = process.env.ANALYSIS_MODE
  ? process.env.ANALYSIS_MODE.trim().toLowerCase()
  : "mock";

/**
 * Defines the analysis modes recognized by the service.
 *
 * Centralizing these identifiers prevents repeated string values and provides a
 * clear place to add future modes such as recorded fixtures or offline test
 * responses.
 */
const ANALYSIS_MODES = {
  MOCK: "mock",
  AI: "ai",
};

// ========================================
// Analysis Mode Validation
// ========================================

/**
 * Verifies that the configured analysis mode is supported.
 *
 * Failing with a descriptive configuration error is preferable to silently
 * selecting a different mode, especially in enterprise deployments where users
 * must know whether requirements are being processed by a real model.
 *
 * @param {string} analysisMode
 * Normalized analysis mode loaded from the server environment.
 *
 * @returns {void}
 *
 * @throws {Error}
 * Throws when the configured mode is not recognized.
 */
const validateAnalysisMode = (analysisMode) => {
  const supportedModes = Object.values(ANALYSIS_MODES);

  if (!supportedModes.includes(analysisMode)) {
    throw new Error(
      `Unsupported ANALYSIS_MODE: ${analysisMode}. Supported modes are: ${supportedModes.join(
        ", "
      )}.`
    );
  }
};

// ========================================
// Mock Process Analysis
// ========================================

/**
 * Creates a deterministic process model for development and regression testing.
 *
 * Mock mode returns the reusable complex process fixture instead of calling an
 * AI provider. This allows frontend editing, validation, JSON export, and Visio
 * export to be tested repeatedly without consuming paid API tokens.
 *
 * A deep clone is created for every request so application edits cannot mutate
 * the shared fixture object stored by Node's module cache.
 *
 * The submitted requirements text is retained as `sourceText` for traceability,
 * even though mock mode does not analyze that text.
 *
 * @param {string} requirements
 * Validated business-requirements text supplied by the user.
 *
 * @returns {object}
 * Independent copy of the complex process fixture.
 */
const createMockProcessModel = (requirements) => {
  const normalizedRequirements = requirements.trim();

  /**
   * `structuredClone` preserves nested arrays and objects without sharing
   * references with the imported fixture.
   *
   * The fixture contains only structured-clone-compatible values such as
   * strings, arrays, and plain objects.
   */
  const mockProcessModel = structuredClone(
    complexProcessModelFixture
  );

  return {
    ...mockProcessModel,
    sourceText: normalizedRequirements,
  };
};

// ========================================
// AI-Powered Process Analysis
// ========================================

/**
 * Converts business requirements into a structured process model through the
 * centrally configured AI provider.
 *
 * The workflow remains provider-independent:
 * 1. Build a provider-neutral process-analysis prompt
 * 2. Submit the prompt through the configured provider service
 * 3. Parse and normalize the provider response
 * 4. Return the standard process-model contract
 *
 * Provider credentials, model selection, request construction, and response
 * extraction remain outside this service in dedicated provider modules.
 *
 * @param {string} requirements
 * Validated business-requirements text supplied by the user.
 *
 * @returns {Promise<object>}
 * Normalized process model compatible with the frontend review workspace.
 *
 * @throws {Error}
 * Throws when prompt construction, provider communication, JSON parsing, or
 * response normalization fails.
 */
const createAiProcessModel = async (requirements) => {
  const processAnalysisPrompt =
    buildProcessAnalysisPrompt(requirements);

  const rawProviderResponse =
    await analyzeWithConfiguredProvider(
      processAnalysisPrompt
    );

  return processAiResponse(rawProviderResponse);
};

// ========================================
// Requirements Analysis Service
// ========================================

/**
 * Analyzes business requirements using the configured backend mode.
 *
 * This function is the single entry point used by the controller. The
 * controller does not need to know whether the result came from mock data,
 * Claude, OpenAI, Ollama, or another approved provider.
 *
 * Keeping mode selection inside the service ensures that:
 * - Frontend and controller contracts remain unchanged
 * - Development can continue without provider credentials
 * - Enterprise deployments can enable AI centrally
 * - Provider changes do not affect routes or interface components
 *
 * @param {string} requirements
 * Validated business-requirements text supplied by the user.
 *
 * @returns {Promise<object>}
 * Structured process model ready to return to the client.
 *
 * @throws {Error}
 * Throws when the analysis mode is invalid or the selected workflow fails.
 */
const analyzeBusinessRequirements = async (requirements) => {
  validateAnalysisMode(configuredAnalysisMode);

  if (configuredAnalysisMode === ANALYSIS_MODES.MOCK) {
    return createMockProcessModel(requirements);
  }

  return createAiProcessModel(requirements);
};

module.exports = {
  ANALYSIS_MODES,
  analyzeBusinessRequirements,
  createAiProcessModel,
  createMockProcessModel,
  validateAnalysisMode,
};