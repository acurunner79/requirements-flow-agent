// ========================================
// Process Response Configuration
// ========================================

/**
 * Defines the process-step types accepted by the application.
 *
 * AI providers may return unexpected or differently capitalized values. These
 * normalized types provide one shared contract for response parsing, backend
 * validation, frontend editing, and Visio shape mapping.
 */
const SUPPORTED_PROCESS_STEP_TYPES = [
  "start",
  "process",
  "decision",
  "end",
];

/**
 * Defines the fallback actor assigned when an AI response omits a usable owner.
 *
 * The response normalizer does not silently invent a business role. Instead, it
 * uses an explicit placeholder that can be surfaced by validation and corrected
 * during the review stage.
 */
const UNASSIGNED_ACTOR = "Unassigned";

// ========================================
// General Response Helpers
// ========================================

/**
 * Determines whether a value contains usable text.
 *
 * This helper is reused throughout parsing and normalization so all string
 * fields follow the same definition of valid text.
 *
 * @param {unknown} value
 * The value to inspect.
 *
 * @returns {boolean}
 * True when the value is a non-empty string after surrounding whitespace is
 * removed.
 */
const hasUsableText = (value) => {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
};

/**
 * Removes Markdown code-fence wrappers from an AI response.
 *
 * Although the prompt instructs providers to return JSON only, some models may
 * still wrap the response in fences such as:
 *
 * ```json
 * { ... }
 * ```
 *
 * Removing only the outer fence allows the parser to recover otherwise valid
 * JSON without modifying the JSON content itself.
 *
 * @param {string} responseText
 * Raw text returned by the configured AI provider.
 *
 * @returns {string}
 * Response text with surrounding Markdown fences removed when present.
 */
const removeMarkdownCodeFences = (responseText) => {
  const trimmedResponse = responseText.trim();

  return trimmedResponse
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
};

/**
 * Parses a raw AI response into a JavaScript object.
 *
 * Parsing is intentionally separated from normalization so malformed provider
 * output can be distinguished from structurally incomplete process data.
 *
 * @param {unknown} responseText
 * Raw provider response expected to contain a JSON object.
 *
 * @returns {object}
 * Parsed JavaScript object.
 *
 * @throws {Error}
 * Throws when the response is missing, is not text, contains invalid JSON, or
 * parses into a non-object value.
 */
const parseProcessModelResponse = (responseText) => {
  if (!hasUsableText(responseText)) {
    throw new Error(
      "The AI provider returned an empty process-analysis response."
    );
  }

  const sanitizedResponse = removeMarkdownCodeFences(responseText);

  let parsedResponse;

  try {
    parsedResponse = JSON.parse(sanitizedResponse);
  } catch {
    throw new Error(
      "The AI provider returned invalid JSON for the process model."
    );
  }

  if (
    !parsedResponse ||
    typeof parsedResponse !== "object" ||
    Array.isArray(parsedResponse)
  ) {
    throw new Error(
      "The AI provider response must contain one process-model object."
    );
  }

  return parsedResponse;
};

// ========================================
// Process Name Normalization
// ========================================

/**
 * Produces a usable process name from the parsed provider response.
 *
 * A neutral fallback is used only when the provider omits the process name.
 * Users can revise this value through the existing process-name editor.
 *
 * @param {unknown} processName
 * Process-name value returned by the AI provider.
 *
 * @returns {string}
 * Trimmed process name or a neutral fallback.
 */
const normalizeProcessName = (processName) => {
  return hasUsableText(processName)
    ? processName.trim()
    : "Untitled Business Process";
};

// ========================================
// Actor Normalization
// ========================================

/**
 * Normalizes one actor value.
 *
 * @param {unknown} actor
 * Actor value returned by the AI provider.
 *
 * @returns {string|null}
 * Trimmed actor name, or null when the value is unusable.
 */
const normalizeActor = (actor) => {
  return hasUsableText(actor)
    ? actor.trim()
    : null;
};

/**
 * Produces a unique, ordered actor collection.
 *
 * Duplicate detection is case-insensitive so values such as "Manager" and
 * "manager" do not become separate swimlanes. The first encountered spelling is
 * preserved.
 *
 * The "Unassigned" placeholder is appended later only when at least one process
 * step requires it.
 *
 * @param {unknown} actors
 * Actor collection returned by the AI provider.
 *
 * @returns {string[]}
 * Unique actor names in their original encounter order.
 */
const normalizeActors = (actors) => {
  if (!Array.isArray(actors)) {
    return [];
  }

  const normalizedActors = [];
  const encounteredActors = new Set();

  actors.forEach((actor) => {
    const normalizedActor = normalizeActor(actor);

    if (!normalizedActor) {
      return;
    }

    const comparisonValue = normalizedActor.toLowerCase();

    if (encounteredActors.has(comparisonValue)) {
      return;
    }

    encounteredActors.add(comparisonValue);
    normalizedActors.push(normalizedActor);
  });

  return normalizedActors;
};

// ========================================
// Process Step Normalization
// ========================================

/**
 * Creates a deterministic process-step identifier from its list position.
 *
 * Provider-supplied identifiers are preserved when valid. This helper supplies
 * stable fallback IDs when they are absent.
 *
 * @param {number} index
 * Zero-based process-step position.
 *
 * @returns {string}
 * Identifier formatted as STEP-001, STEP-002, and so forth.
 */
const createFallbackStepId = (index) => {
  return `STEP-${String(index + 1).padStart(3, "0")}`;
};

/**
 * Normalizes a process-step type.
 *
 * Unsupported types fall back to "process" rather than being discarded. The
 * backend validation layer can still detect provider-quality issues later if
 * stricter rejection is desired.
 *
 * @param {unknown} stepType
 * Process-step type returned by the AI provider.
 *
 * @returns {string}
 * Supported normalized process-step type.
 */
const normalizeStepType = (stepType) => {
  if (!hasUsableText(stepType)) {
    return "process";
  }

  const normalizedStepType = stepType.trim().toLowerCase();

  return SUPPORTED_PROCESS_STEP_TYPES.includes(normalizedStepType)
    ? normalizedStepType
    : "process";
};

/**
 * Normalizes outgoing process-step identifiers.
 *
 * Empty, non-string, and duplicate references are removed. The original order
 * is preserved because connector order may later influence branch presentation.
 *
 * @param {unknown} nextStepIds
 * Outgoing step references returned by the AI provider.
 *
 * @returns {string[]}
 * Unique, trimmed outgoing step identifiers.
 */
const normalizeNextStepIds = (nextStepIds) => {
  if (!Array.isArray(nextStepIds)) {
    return [];
  }

  const normalizedIds = [];
  const encounteredIds = new Set();

  nextStepIds.forEach((nextStepId) => {
    if (!hasUsableText(nextStepId)) {
      return;
    }

    const normalizedId = nextStepId.trim();

    if (encounteredIds.has(normalizedId)) {
      return;
    }

    encounteredIds.add(normalizedId);
    normalizedIds.push(normalizedId);
  });

  return normalizedIds;
};

/**
 * Normalizes one outgoing connection object.
 *
 * Each connection must contain a valid target process-step identifier.
 * Connector labels remain optional and are normalized to trimmed strings.
 *
 * Invalid connection entries are discarded rather than creating unusable
 * diagram connectors.
 *
 * @param {unknown} connection
 * Raw connection value returned by the AI provider.
 *
 * @returns {object|null}
 * Normalized connection object, or null when the target is invalid.
 */
const normalizeConnection = (connection) => {
  if (
    !connection ||
    typeof connection !== "object" ||
    Array.isArray(connection) ||
    !hasUsableText(connection.targetStepId)
  ) {
    return null;
  }

  return {
    targetStepId: connection.targetStepId.trim(),
    label: hasUsableText(connection.label)
      ? connection.label.trim()
      : "",
  };
};

/**
 * Normalizes the outgoing connection collection for one process step.
 *
 * Duplicate target-and-label combinations are removed while preserving their
 * original order. This prevents repeated connectors from appearing in the
 * review interface and generated Visio workbook.
 *
 * @param {unknown} connections
 * Raw connection collection returned by the AI provider.
 *
 * @returns {Array<object>}
 * Unique normalized connection objects.
 */
const normalizeConnections = (connections) => {
  if (!Array.isArray(connections)) {
    return [];
  }

  const normalizedConnections = [];
  const encounteredConnections = new Set();

  connections.forEach((connection) => {
    const normalizedConnection = normalizeConnection(connection);

    if (!normalizedConnection) {
      return;
    }

    const comparisonKey = [
      normalizedConnection.targetStepId,
      normalizedConnection.label.toLowerCase(),
    ].join("::");

    if (encounteredConnections.has(comparisonKey)) {
      return;
    }

    encounteredConnections.add(comparisonKey);
    normalizedConnections.push(normalizedConnection);
  });

  return normalizedConnections;
};

/**
 * Converts legacy next-step identifiers into rich connection objects.
 *
 * Rich `connections` data is authoritative throughout the application. This
 * helper exists only so responses from older prompts or alternate providers
 * that still return `nextStepIds` can be migrated safely.
 *
 * Legacy connections do not contain branch labels, so each migrated connection
 * receives an empty label.
 *
 * @param {unknown} nextStepIds
 * Legacy outgoing step identifiers returned by an AI provider.
 *
 * @returns {Array<object>}
 * Rich connection objects containing target identifiers and empty labels.
 */
const createConnectionsFromLegacyNextStepIds = (
  nextStepIds
) => {
  return normalizeNextStepIds(nextStepIds).map(
    (targetStepId) => ({
      targetStepId,
      label: "",
    })
  );
};


/**
 * Resolves the authoritative outgoing connections for one provider step.
 *
 * Valid rich connection objects are preferred. Legacy `nextStepIds` are used
 * only when the response does not contain any valid rich connections.
 *
 * End steps always return an empty collection because they terminate the flow.
 *
 * @param {object} step
 * Raw AI-generated process step.
 *
 * @param {string} normalizedType
 * Supported normalized process-step type.
 *
 * @returns {Array<object>}
 * Normalized rich outgoing connections.
 */
const resolveProcessStepConnections = (
  step,
  normalizedType
) => {
  if (normalizedType === "end") {
    return [];
  }

  const normalizedConnections =
    normalizeConnections(step.connections);

  if (normalizedConnections.length > 0) {
    return normalizedConnections;
  }

  return createConnectionsFromLegacyNextStepIds(
    step.nextStepIds
  );
};

/**
 * Normalizes one AI-generated process step.
 *
 * Rich `connections` data is the authoritative outgoing-path structure. When a
 * provider returns only legacy `nextStepIds`, those identifiers are migrated
 * into unlabeled rich connection objects.
 *
 * The normalized step exposes only the rich `connections` representation.
 *
 * Missing descriptions and owners are preserved through explicit placeholders
 * rather than silently deleting the step. This keeps incomplete process data
 * visible for human review.
 *
 * End steps always receive empty outgoing collections because they terminate
 * the process.
 *
 * @param {unknown} step
 * Raw process-step value returned by the AI provider.
 *
 * @param {number} index
 * Zero-based step position used for fallback identifiers and labels.
 *
 * @returns {object|null}
 * Normalized process step, or null when the supplied value is not an object.
 */
const normalizeProcessStep = (
  step,
  index
) => {
  if (
    !step ||
    typeof step !== "object" ||
    Array.isArray(step)
  ) {
    return null;
  }

  const normalizedType =
    normalizeStepType(step.type);

  const connections =
    resolveProcessStepConnections(
      step,
      normalizedType
    );

  return {
    id: hasUsableText(step.id)
      ? step.id.trim()
      : createFallbackStepId(index),

    type: normalizedType,

    label: hasUsableText(step.label)
      ? step.label.trim()
      : `Review process step ${index + 1}`,

      owner: hasUsableText(step.owner)
      ? step.owner.trim()
      : UNASSIGNED_ACTOR,

    connections,
  };
};

/**
 * Normalizes the complete process-step collection.
 *
 * Invalid non-object entries are removed while valid step objects are preserved
 * and normalized.
 *
 * @param {unknown} steps
 * Process-step collection returned by the AI provider.
 *
 * @returns {object[]}
 * Ordered normalized process-step collection.
 */
const normalizeProcessSteps = (steps) => {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps
    .map((step, index) => normalizeProcessStep(step, index))
    .filter(Boolean);
};

// ========================================
// Warning Normalization
// ========================================

/**
 * Normalizes one AI-generated warning.
 *
 * Providers may return warnings as structured objects or plain strings. Both
 * forms are converted into the same application contract.
 *
 * @param {unknown} warning
 * Warning value returned by the AI provider.
 *
 * @param {number} index
 * Zero-based position used to create a fallback warning code.
 *
 * @returns {object|null}
 * Normalized warning object, or null when the warning is unusable.
 */
const normalizeWarning = (warning, index) => {
  if (hasUsableText(warning)) {
    return {
      code: `AI_WARNING_${String(index + 1).padStart(3, "0")}`,
      message: warning.trim(),
    };
  }

  if (
    !warning ||
    typeof warning !== "object" ||
    Array.isArray(warning) ||
    !hasUsableText(warning.message)
  ) {
    return null;
  }

  return {
    code: hasUsableText(warning.code)
      ? warning.code.trim()
      : `AI_WARNING_${String(index + 1).padStart(3, "0")}`,

    message: warning.message.trim(),
  };
};

/**
 * Normalizes all provider-generated warnings.
 *
 * @param {unknown} warnings
 * Warning collection returned by the AI provider.
 *
 * @returns {object[]}
 * Ordered normalized warning collection.
 */
const normalizeWarnings = (warnings) => {
  if (!Array.isArray(warnings)) {
    return [];
  }

  return warnings
    .map((warning, index) => normalizeWarning(warning, index))
    .filter(Boolean);
};

// ========================================
// Normalized Process Structure Validation
// ========================================

/**
 * Validates structural relationships that must remain unambiguous throughout
 * process editing and export.
 *
 * Human-review concerns such as missing owners, generic labels, or incomplete
 * workflow semantics remain available to the frontend validation layer.
 *
 * This helper rejects only structural defects that cannot be represented
 * reliably:
 * - Duplicate process-step identifiers
 * - Connections targeting process steps that do not exist
 *
 * @param {Array<object>} steps
 * Normalized process-step collection.
 *
 * @returns {void}
 *
 * @throws {Error}
 * Throws when identifiers or connection targets are structurally invalid.
 */
const validateNormalizedProcessSteps = (steps) => {
  const encounteredStepIds = new Set();

  steps.forEach((step) => {
    if (encounteredStepIds.has(step.id)) {
      throw new Error(
        `The AI provider returned duplicate process-step ID: ${step.id}.`
      );
    }

    encounteredStepIds.add(step.id);
  });

  steps.forEach((step) => {
    step.connections.forEach((connection) => {
      if (!encounteredStepIds.has(connection.targetStepId)) {
        throw new Error(
          `The AI provider returned a connection from ${step.id} to unknown process-step ID: ${connection.targetStepId}.`
        );
      }
    });
  });
};

// ========================================
// Complete Process Model Normalization
// ========================================

/**
 * Converts a parsed AI response into the application process-model contract.
 *
 * Normalization protects the rest of the application from minor provider
 * inconsistencies while preserving incomplete information for human review.
 *
 * Actor ownership is synchronized as follows:
 * - Actors explicitly returned by the provider are preserved.
 * - Owners referenced by steps are added when missing from the actor list.
 * - "Unassigned" is included only when at least one step uses it.
 *
 * @param {object} parsedResponse
 * Parsed provider response object.
 *
 * @returns {object}
 * Normalized process model compatible with the frontend review workflow.
 *
 * @throws {Error}
 * Throws when no usable process steps remain after normalization.
 */
const normalizeProcessModelResponse = (parsedResponse) => {
  if (
    !parsedResponse ||
    typeof parsedResponse !== "object" ||
    Array.isArray(parsedResponse)
  ) {
    throw new Error(
      "A parsed process-model object is required for normalization."
    );
  }

  const normalizedSteps = normalizeProcessSteps(
    parsedResponse.steps
  );

  if (normalizedSteps.length === 0) {
    throw new Error(
      "The AI provider response did not contain any usable process steps."
    );
  }

    /**
   * Reject ambiguous identifiers and dangling connections before the model is
   * returned to the application.
   */
  validateNormalizedProcessSteps(normalizedSteps);

  const normalizedActors = normalizeActors(
    parsedResponse.actors
  );

  const encounteredActors = new Set(
    normalizedActors.map((actor) => actor.toLowerCase())
  );

  /**
   * Ensure every step owner is represented in the actor collection.
   *
   * This keeps owner values and future Visio swimlane values synchronized even
   * when the provider forgets to include one of the step owners in `actors`.
   */
  normalizedSteps.forEach((step) => {
    const comparisonValue = step.owner.toLowerCase();

    if (!encounteredActors.has(comparisonValue)) {
      encounteredActors.add(comparisonValue);
      normalizedActors.push(step.owner);
    }
  });

  return {
    processName: normalizeProcessName(
      parsedResponse.processName
    ),

    actors: normalizedActors,

    steps: normalizedSteps,

    warnings: normalizeWarnings(
      parsedResponse.warnings
    ),
  };
};

/**
 * Parses and normalizes a raw AI provider response in one operation.
 *
 * This is the primary helper that the requirements-analysis service will call
 * after receiving text from any configured provider.
 *
 * @param {unknown} responseText
 * Raw text returned by the configured AI provider.
 *
 * @returns {object}
 * Parsed and normalized process model.
 */
const processAiResponse = (responseText) => {
  const parsedResponse = parseProcessModelResponse(responseText);

  return normalizeProcessModelResponse(parsedResponse);
};

module.exports = {
  SUPPORTED_PROCESS_STEP_TYPES,
  UNASSIGNED_ACTOR,
  createConnectionsFromLegacyNextStepIds,
  createFallbackStepId,
  normalizeActor,
  normalizeActors,
  normalizeConnection,
  normalizeConnections,
  normalizeNextStepIds,
  normalizeProcessModelResponse,
  normalizeProcessStep,
  normalizeProcessSteps,
  normalizeStepType,
  normalizeWarning,
  normalizeWarnings,
  parseProcessModelResponse,
  processAiResponse,
  removeMarkdownCodeFences,
  resolveProcessStepConnections,
  validateNormalizedProcessSteps,
};