// ========================================
// Process Analysis Prompt Configuration
// ========================================

/**
 * Defines the process-step types currently supported by the application.
 *
 * These values must remain aligned with:
 * - Frontend step-editing options
 * - Backend and frontend validation rules
 * - Visio shape mappings
 * - AI response normalization
 *
 * Centralizing the supported values in the prompt helps ensure every configured
 * AI provider returns data compatible with the rest of the application.
 */
const SUPPORTED_PROCESS_STEP_TYPES = [
  "start",
  "process",
  "decision",
  "end",
];

/**
 * Defines the exact JSON response structure expected from the AI provider.
 *
 * Each process step includes a `connections` array containing:
 * - `targetStepId`: Destination process-step identifier
 * - `label`: Optional connector text such as Yes, No, Approved, or Rejected
 *
 * The AI provider should not return the legacy `nextStepIds` property.
 * Backend normalization accepts legacy provider input when necessary, but the
 * normalized application model exposes only rich `connections`.
 *
 * This object is used only as a prompt example. It is never returned directly
 * to the client.
 */
const PROCESS_MODEL_RESPONSE_EXAMPLE = {
  processName: "Customer Refund Review",
  actors: [
    "Customer",
    "Customer Service",
    "Manager",
  ],
  steps: [
    {
      id: "STEP-001",
      type: "start",
      label: "Refund request received",
      owner: "Customer Service",
      connections: [
        {
          targetStepId: "STEP-002",
          label: "",
        },
      ],
    },
    {
      id: "STEP-002",
      type: "decision",
      label: "Is manager approval required?",
      owner: "Customer Service",
      connections: [
        {
          targetStepId: "STEP-003",
          label: "Yes",
        },
        {
          targetStepId: "STEP-004",
          label: "No",
        },
      ],
    },
    {
      id: "STEP-003",
      type: "process",
      label: "Approve refund request",
      owner: "Manager",
      connections: [
        {
          targetStepId: "STEP-004",
          label: "",
        },
      ],
    },
    {
      id: "STEP-004",
      type: "end",
      label: "Refund review completed",
      owner: "Customer Service",
      connections: [],
    },
  ],
  warnings: [
    {
      code: "MISSING_APPROVAL_THRESHOLD",
      message:
        "The requirements do not define when manager approval is required.",
    },
  ],
};

// ========================================
// Prompt Formatting Helpers
// ========================================

/**
 * Formats the supported process-step types as a readable prompt value.
 *
 * Keeping this transformation separate allows future prompt builders to reuse
 * the same supported-type list without duplicating formatting logic.
 *
 * @returns {string}
 * Comma-separated list of supported process-step types.
 */
const formatSupportedStepTypes = () => {
  return SUPPORTED_PROCESS_STEP_TYPES.join(", ");
};

/**
 * Converts the response example into formatted JSON for inclusion in the
 * provider prompt.
 *
 * Two-space indentation makes the response contract easier for both developers
 * and AI models to interpret.
 *
 * @returns {string}
 * Formatted JSON representation of the expected response structure.
 */
const formatResponseExample = () => {
  return JSON.stringify(
    PROCESS_MODEL_RESPONSE_EXAMPLE,
    null,
    2
  );
};

// ========================================
// Business Requirements Analysis Prompt
// ========================================

/**
 * Builds the provider-neutral prompt used to analyze business requirements.
 *
 * The prompt is intentionally independent from OpenAI, Anthropic, Ollama, or
 * any other provider-specific request format. Provider adapters receive this
 * completed instruction and submit it through their own SDK or HTTP API.
 *
 * The prompt instructs the model to:
 * - Identify the process name
 * - Extract unique actors
 * - Build ordered process steps
 * - Assign valid step types
 * - Create deterministic step identifiers
 * - Preserve outgoing connections and branch labels
 * - Identify ambiguity without inventing business rules
 * - Return JSON only
 *
 * @param {string} requirements
 * Validated business-requirements text supplied by the user.
 *
 * @returns {string}
 * Complete AI instruction ready for submission to a configured provider.
 *
 * @throws {Error}
 * Throws when the supplied requirements value is missing or contains no usable
 * text.
 */
const buildProcessAnalysisPrompt = (requirements) => {
  if (
    typeof requirements !== "string" ||
    !requirements.trim()
  ) {
    throw new Error(
      "Valid business requirements are required to build the analysis prompt."
    );
  }

  const normalizedRequirements = requirements.trim();

  return `
You are a senior business process analyst.

Your task is to convert the supplied business requirements into a structured
process model that can later be reviewed and exported into a Microsoft Visio
process flow.

ANALYSIS RULES

1. Identify one concise process name.
2. Identify every unique actor, role, department, team, or system involved.
3. Convert the requirements into an ordered collection of process steps.
4. Use only these step types:
   ${formatSupportedStepTypes()}
5. Assign step identifiers sequentially using this format:
   STEP-001, STEP-002, STEP-003
6. Every non-end step must include a connections array containing every outgoing
   path.
7. Each connection object must contain:
   - targetStepId: the next process-step identifier
   - label: connector text such as Yes, No, Approved, Rejected, or an empty
     string when no label is needed
8. Decision steps should include every explicitly supported outgoing branch and
   should use clear connector labels whenever the requirements distinguish the
   outcomes.
9. Do not include the legacy nextStepIds property.
10. End steps must use an empty connections array.
11. The normalized application model must expose only the rich connections
    structure for outgoing paths.
12. Do not invent missing business rules, thresholds, approvals, owners, branch
    outcomes, or exception paths.
13. When required information is missing, contradictory, or ambiguous, preserve
    the process as far as possible and add a warning.
14. Keep step labels concise, action-oriented, and suitable for diagram shapes.
15. Each step owner must match one value from the actors array.
16. Return valid JSON only.
17. Do not wrap the response in Markdown or code fences.
18. Do not include commentary before or after the JSON object.

EXPECTED RESPONSE STRUCTURE

${formatResponseExample()}

BUSINESS REQUIREMENTS

${normalizedRequirements}
`.trim();
};

module.exports = {
  PROCESS_MODEL_RESPONSE_EXAMPLE,
  SUPPORTED_PROCESS_STEP_TYPES,
  buildProcessAnalysisPrompt,
};