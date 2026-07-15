// ========================================
// Service Dependencies
// ========================================

const {
  analyzeWithConfiguredProvider,
} = require("./aiProviderService");
const {
  buildProcessAnalysisPrompt,
  buildProcessCorrectionPrompt,
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
// AI Process Model Factory
// ========================================

/**
 * Creates an AI-powered process-analysis function using the supplied workflow
 * dependencies.
 *
 * Dependency injection allows automated tests to verify prompt construction,
 * provider invocation, response normalization, corrective retry behavior, and
 * structured logging without loading a live provider adapter or consuming API
 * tokens.
 *
 * Production continues using the real prompt builders, configured provider
 * service, response normalizer, and server console logger.
 *
 * @param {object} dependencies
 * AI workflow dependencies.
 *
 * @param {(requirements: string) => string} dependencies.promptBuilder
 * Function that converts requirements into a provider-neutral prompt.
 *
 * @param {
 *   (
 *     originalPrompt: string,
 *     invalidResponse: string,
 *     processingError: unknown
 *   ) => string
 * } dependencies.correctionPromptBuilder
 * Function that creates one corrective prompt after response processing fails.
 *
 * @param {(prompt: string) => Promise<string>} dependencies.providerAnalyzer
 * Function that submits a prompt and returns the raw provider response.
 *
 * @param {(responseText: string) => object} dependencies.responseProcessor
 * Function that parses and normalizes a raw provider response.
 *
 * @param {object} [dependencies.logger=console]
 * Structured logger used for corrective-retry observability.
 *
 * @param {(message: string, details?: object) => void} dependencies.logger.warn
 * Records when a corrective retry is triggered.
 *
 * @param {(message: string, details?: object) => void} dependencies.logger.info
 * Records successful corrective recovery.
 *
 * @param {(message: string, details?: object) => void} dependencies.logger.error
 * Records a failed corrective attempt.
 *
 * @returns {(requirements: string) => Promise<object>}
 * Configured AI process-analysis function.
 */
const createAiProcessModelFactory = ({
  promptBuilder,
  correctionPromptBuilder,
  providerAnalyzer,
  responseProcessor,
  logger = console,
}) => {
  return async (requirements) => {
    /**
     * Build the complete provider-neutral prompt from the validated business
     * requirements.
     */
    const processAnalysisPrompt =
      promptBuilder(requirements);

    /**
     * Submit the original prompt through the configured provider boundary.
     *
     * Provider failures are intentionally allowed to propagate. A corrective
     * retry is reserved only for responses that were returned successfully but
     * failed parsing or structural validation.
     */
    const rawProviderResponse =
      await providerAnalyzer(
        processAnalysisPrompt
      );

    try {
      /**
       * Attempt to convert the first provider response into the application
       * process-model contract.
       */
      return responseProcessor(rawProviderResponse);
    } catch (processingError) {
      /**
       * Record only the controlled validation failure category.
       *
       * Requirements, prompts, and raw provider responses are intentionally
       * excluded from logs.
       */
      logger.warn(
        "AI process response required corrective retry.",
        {
          event: "ai_process_correction_started",
          errorName:
            processingError instanceof Error
              ? processingError.name
              : "UnknownError",
          errorMessage:
            processingError instanceof Error
              ? processingError.message
              : "Unknown response-processing failure.",
        }
      );

      /**
       * Build one corrective prompt containing the validation failure and the
       * invalid provider response.
       */
      const correctionPrompt =
        correctionPromptBuilder(
          processAnalysisPrompt,
          rawProviderResponse,
          processingError
        );

      try {
        /**
         * Submit exactly one corrective request.
         *
         * The workflow never performs a third provider request.
         */
        const correctedProviderResponse =
          await providerAnalyzer(
            correctionPrompt
          );

        /**
         * Process the corrected response using the same application contract
         * enforced during the original attempt.
         */
        const correctedProcessModel =
          responseProcessor(
            correctedProviderResponse
          );

        logger.info(
          "AI process response recovered after corrective retry.",
          {
            event: "ai_process_correction_succeeded",
          }
        );

        return correctedProcessModel;
      } catch (correctionError) {
        /**
         * Record the failed recovery without exposing requirements, prompts, or
         * raw provider output.
         */
        logger.error(
          "AI process corrective retry failed.",
          {
            event: "ai_process_correction_failed",
            errorName:
              correctionError instanceof Error
                ? correctionError.name
                : "UnknownError",
            errorMessage:
              correctionError instanceof Error
                ? correctionError.message
                : "Unknown corrective-retry failure.",
          }
        );

        /**
         * Preserve the final provider or response-processing error for the
         * existing controller error path.
         */
        throw correctionError;
      }
    }
  };
};

// ========================================
// Production AI Process Analysis
// ========================================

/**
 * Production AI workflow configured with the real application dependencies.
 */
const createAiProcessModel =
  createAiProcessModelFactory({
    promptBuilder: buildProcessAnalysisPrompt,
    correctionPromptBuilder:
      buildProcessCorrectionPrompt,
    providerAnalyzer: analyzeWithConfiguredProvider,
    responseProcessor: processAiResponse,
  });

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
  createAiProcessModelFactory,
  createMockProcessModel,
  validateAnalysisMode,
};