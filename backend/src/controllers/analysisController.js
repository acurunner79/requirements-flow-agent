// ========================================
// Controller Dependencies
// ========================================

const {
  analyzeBusinessRequirements,
} = require("../services/requirementsAnalysisService");
const {
  hasValidRequirementsText,
} = require("../utils/validationUtils");

// ========================================
// Requirements Analysis Controller Factory
// ========================================

/**
 * Creates a requirements-analysis controller using the supplied analysis
 * service.
 *
 * Dependency injection keeps the production route connected to the real
 * service while allowing automated tests to provide a deterministic failing
 * service without making an AI-provider request.
 *
 * @param {(
 *   requirements: string,
 *   context?: { requestId?: string }
 * ) => Promise<object>} analysisService
 * Service function responsible for converting validated requirements into a
 * structured process model.
 *
 * The optional context carries request-scoped diagnostic information without
 * including the submitted business requirements in logs.
 *
 * @returns {(
 *   req: import("express").Request,
 *   res: import("express").Response
 * ) => Promise<import("express").Response>}
 * Configured Express controller.
 */
const createAnalyzeRequirementsController = (
  analysisService
) => {
  return async (req, res) => {
    const { requirements } = req.body;

    /**
     * Reject invalid input before invoking the analysis service.
     *
     * This prevents missing or malformed requirements from reaching mock
     * processing or a paid AI provider.
     */
    if (!hasValidRequirementsText(requirements)) {
      return res.status(400).json({
        error: "Business requirements are required.",
      });
    }

    try {
      /**
       * Delegate the complete analysis workflow to the injected service.
       */
      const processModel =
        await analysisService(
          requirements,
          {
            requestId: req.requestId,
          }
        );

      return res.status(200).json(processModel);
    } catch (error) {
      /**
       * Preserve the complete error for server-side diagnostics without adding
       * requirements text or provider credentials to the log message.
       */
      console.error(
        "Business requirements analysis failed.",
        {
          event: "business_requirements_analysis_failed",
          requestId: req.requestId,
          errorName:
            error instanceof Error
              ? error.name
              : "UnknownError",
          errorMessage:
            error instanceof Error
              ? error.message
              : "Unknown analysis failure.",
        }
      );

      /**
       * Return a consistent error response to the client.
       */
      return res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while analyzing the requirements.",
      });
    }
  };
};

// ========================================
// Production Requirements Analysis Controller
// ========================================

/**
 * Production controller configured with the real requirements-analysis service.
 */
const analyzeRequirements =
  createAnalyzeRequirementsController(
    analyzeBusinessRequirements
  );

module.exports = {
  analyzeRequirements,
  createAnalyzeRequirementsController,
};