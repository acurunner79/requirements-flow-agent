// ========================================
// Process Validation Constants
// ========================================

/**
 * Defines the process-step types recognized by the current validation rules.
 *
 * These values must remain aligned with:
 * - Backend AI prompt instructions
 * - Backend response normalization
 * - Frontend step-editing options
 * - Visio shape mappings
 */
const PROCESS_STEP_TYPES = {
  START: "start",
  PROCESS: "process",
  DECISION: "decision",
  END: "end",
};

/**
 * Defines the severity levels returned by process validation.
 *
 * Errors represent conditions that should block export because they would
 * produce an invalid or incomplete process diagram.
 *
 * Warnings identify conditions that require human review but may not prevent
 * export.
 */
const VALIDATION_SEVERITIES = {
  ERROR: "error",
  WARNING: "warning",
};

// ========================================
// General Validation Helpers
// ========================================

/**
 * Creates a consistent validation issue object.
 *
 * Every validation rule returns the same shape so issues can be grouped,
 * displayed, counted, and associated with process steps consistently.
 *
 * @param {object} issue - Validation issue configuration.
 * @param {string} issue.code
 * Stable machine-readable identifier for the validation rule.
 * @param {string} issue.severity
 * Validation severity such as "error" or "warning".
 * @param {string} issue.message
 * Human-readable explanation of the detected issue.
 * @param {string|null} [issue.stepId=null]
 * Optional identifier of the affected process step.
 * @returns {object} A normalized validation issue.
 */
const createValidationIssue = ({
  code,
  severity,
  message,
  stepId = null,
}) => {
  return {
    code,
    severity,
    message,
    stepId,
  };
};

/**
 * Determines whether a value contains usable text.
 *
 * This helper is reused for process names, step IDs, labels, owners, connector
 * labels, and connection targets so every validation rule follows the same
 * definition of valid text.
 *
 * @param {unknown} value - Value to inspect.
 * @returns {boolean}
 * True when the value is a non-empty string after trimming.
 */
const hasUsableText = (value) => {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
};

/**
 * Creates a set containing every valid process-step identifier.
 *
 * A Set provides efficient lookups when validating outgoing connections and
 * prevents repeated scans of the complete step collection.
 *
 * @param {Array<object>} steps - Process steps to inspect.
 * @returns {Set<string>} Unique usable process-step identifiers.
 */
const createStepIdSet = (steps) => {
  return new Set(
    steps
      .map((step) => step.id)
      .filter(hasUsableText)
      .map((stepId) => stepId.trim())
  );
};

// ========================================
// Connection Normalization Helpers
// ========================================

/**
 * Returns the rich outgoing connections for one process step.
 *
 * `connections` is the authoritative process-path structure throughout the
 * frontend. A defensive empty-array fallback prevents validation failures if an
 * incomplete step reaches the validator.
 *
 * @param {object} step
 * Process step to inspect.
 *
 * @returns {Array<object>}
 * Rich outgoing connection objects.
 */
const getStepConnections = (step) => {
  return Array.isArray(step.connections)
    ? step.connections
    : [];
};

/**
 * Determines whether a connection contains a usable target identifier.
 *
 * @param {unknown} connection - Connection value to inspect.
 * @returns {boolean}
 * True when the connection is an object with a non-empty target step ID.
 */
const hasValidConnectionTarget = (connection) => {
  return (
    connection &&
    typeof connection === "object" &&
    !Array.isArray(connection) &&
    hasUsableText(connection.targetStepId)
  );
};

// ========================================
// Process Model Validation
// ========================================

/**
 * Validates a structured process model and returns all detected issues.
 *
 * The validator intentionally returns every issue instead of stopping after the
 * first failure. This provides users with a complete review checklist and
 * prevents repeated fix-and-resubmit cycles.
 *
 * Current validation rules check for:
 * - Missing or invalid process-model data
 * - Missing process name
 * - Missing actors
 * - Missing process steps
 * - Missing or duplicate step identifiers
 * - Missing step descriptions
 * - Missing or unassigned owners
 * - Unsupported process-step types
 * - Missing start and end steps
 * - Invalid connection targets
 * - Duplicate outgoing connections
 * - Decision steps with fewer than two branches
 * - Decision branches without connector labels
 * - Non-end steps without outgoing connections
 * - End steps containing outgoing connections
 *
 * @param {object} processModel
 * The complete structured process model to validate.
 *
 * @returns {Array<object>}
 * Ordered collection of normalized validation issues. An empty array indicates
 * that no current validation rules detected a problem.
 */
const validateProcessModel = (processModel) => {
  const issues = [];

  // A missing or non-object process model prevents all other validation rules
  // from running safely.
  if (!processModel || typeof processModel !== "object") {
    return [
      createValidationIssue({
        code: "INVALID_PROCESS_MODEL",
        severity: VALIDATION_SEVERITIES.ERROR,
        message: "A valid process model is required.",
      }),
    ];
  }

  // The process name becomes the diagram title and export filename foundation.
  if (!hasUsableText(processModel.processName)) {
    issues.push(
      createValidationIssue({
        code: "MISSING_PROCESS_NAME",
        severity: VALIDATION_SEVERITIES.ERROR,
        message: "Enter a process name before exporting.",
      })
    );
  }

  // Actors become process owners and future Visio swimlanes.
  if (
    !Array.isArray(processModel.actors) ||
    processModel.actors.length === 0
  ) {
    issues.push(
      createValidationIssue({
        code: "MISSING_ACTORS",
        severity: VALIDATION_SEVERITIES.ERROR,
        message: "Add at least one actor to the process.",
      })
    );
  }

  // Step-specific validation cannot continue without a usable steps array.
  if (
    !Array.isArray(processModel.steps) ||
    processModel.steps.length === 0
  ) {
    issues.push(
      createValidationIssue({
        code: "MISSING_PROCESS_STEPS",
        severity: VALIDATION_SEVERITIES.ERROR,
        message: "Add at least one process step.",
      })
    );

    return issues;
  }

  const stepIds = createStepIdSet(processModel.steps);
  const encounteredStepIds = new Set();

  let startStepCount = 0;
  let endStepCount = 0;

  processModel.steps.forEach((step, index) => {
    const displayPosition = index + 1;

    const stepId = hasUsableText(step.id)
      ? step.id.trim()
      : null;

    const stepLabel = hasUsableText(step.label)
      ? step.label.trim()
      : `Step ${displayPosition}`;

    // Every process step requires a unique identifier because connections and
    // exports reference steps by ID.
    if (!stepId) {
      issues.push(
        createValidationIssue({
          code: "MISSING_STEP_ID",
          severity: VALIDATION_SEVERITIES.ERROR,
          message: `${stepLabel} does not have a step ID.`,
        })
      );
    } else if (encounteredStepIds.has(stepId)) {
      issues.push(
        createValidationIssue({
          code: "DUPLICATE_STEP_ID",
          severity: VALIDATION_SEVERITIES.ERROR,
          message: `Step ID ${stepId} is used more than once.`,
          stepId,
        })
      );
    } else {
      encounteredStepIds.add(stepId);
    }

    // Step descriptions become shape labels in the generated diagram.
    if (!hasUsableText(step.label)) {
      issues.push(
        createValidationIssue({
          code: "MISSING_STEP_LABEL",
          severity: VALIDATION_SEVERITIES.ERROR,
          message: `Step ${displayPosition} requires a description.`,
          stepId,
        })
      );
    }

    // Owners determine actor responsibility and future swimlane placement.
    if (!hasUsableText(step.owner)) {
      issues.push(
        createValidationIssue({
          code: "MISSING_STEP_OWNER",
          severity: VALIDATION_SEVERITIES.ERROR,
          message: `${stepLabel} requires an owner.`,
          stepId,
        })
      );
    } else if (step.owner.trim().toLowerCase() === "unassigned") {
      issues.push(
        createValidationIssue({
          code: "UNASSIGNED_STEP_OWNER",
          severity: VALIDATION_SEVERITIES.WARNING,
          message: `${stepLabel} is currently unassigned.`,
          stepId,
        })
      );
    }

    const normalizedStepType = hasUsableText(step.type)
      ? step.type.trim().toLowerCase()
      : "";

    const supportedStepTypes = Object.values(PROCESS_STEP_TYPES);

    if (!supportedStepTypes.includes(normalizedStepType)) {
      issues.push(
        createValidationIssue({
          code: "INVALID_STEP_TYPE",
          severity: VALIDATION_SEVERITIES.ERROR,
          message: `${stepLabel} has an unsupported step type.`,
          stepId,
        })
      );
    }

    if (normalizedStepType === PROCESS_STEP_TYPES.START) {
      startStepCount += 1;
    }

    if (normalizedStepType === PROCESS_STEP_TYPES.END) {
      endStepCount += 1;
    }

    const connections = getStepConnections(step);
    const encounteredConnections = new Set();

    /**
     * Validate every outgoing connection independently.
     *
     * This ensures connectors have valid targets, do not duplicate another
     * target-and-label combination, and point to an existing process step.
     */
    connections.forEach((connection, connectionIndex) => {
      const connectionNumber = connectionIndex + 1;

      if (!hasValidConnectionTarget(connection)) {
        issues.push(
          createValidationIssue({
            code: "MISSING_CONNECTION_TARGET",
            severity: VALIDATION_SEVERITIES.ERROR,
            message:
              `${stepLabel} has an outgoing connection without a valid ` +
              `target step.`,
            stepId,
          })
        );

        return;
      }

      const normalizedTargetStepId =
        connection.targetStepId.trim();

      const normalizedConnectorLabel =
        hasUsableText(connection.label)
          ? connection.label.trim()
          : "";

      // Prevent connectors from pointing to process steps that do not exist.
      if (!stepIds.has(normalizedTargetStepId)) {
        issues.push(
          createValidationIssue({
            code: "INVALID_CONNECTION_TARGET",
            severity: VALIDATION_SEVERITIES.ERROR,
            message:
              `${stepLabel} references an invalid target step: ` +
              `${normalizedTargetStepId}.`,
            stepId,
          })
        );
      }

      // Self-referencing connections are normally accidental and can produce
      // unusable loops in the generated diagram.
      if (normalizedTargetStepId === stepId) {
        issues.push(
          createValidationIssue({
            code: "SELF_REFERENCING_CONNECTION",
            severity: VALIDATION_SEVERITIES.WARNING,
            message:
              `${stepLabel} contains a connection back to itself.`,
            stepId,
          })
        );
      }

      /**
       * Treat the combination of target and label as the connection identity.
       *
       * This still allows two branches to reach the same target when their
       * labels describe different outcomes.
       */
      const connectionKey = [
        normalizedTargetStepId,
        normalizedConnectorLabel.toLowerCase(),
      ].join("::");

      if (encounteredConnections.has(connectionKey)) {
        issues.push(
          createValidationIssue({
            code: "DUPLICATE_CONNECTION",
            severity: VALIDATION_SEVERITIES.WARNING,
            message:
              `${stepLabel} contains a duplicate outgoing connection at ` +
              `position ${connectionNumber}.`,
            stepId,
          })
        );
      } else {
        encounteredConnections.add(connectionKey);
      }

      /**
       * Decision branches require meaningful connector labels.
       *
       * Labels such as Yes, No, Approved, Rejected, Match, or Exception allow a
       * reader to understand why each branch was followed.
       */
      if (
        normalizedStepType === PROCESS_STEP_TYPES.DECISION &&
        !normalizedConnectorLabel
      ) {
        issues.push(
          createValidationIssue({
            code: "MISSING_DECISION_CONNECTION_LABEL",
            severity: VALIDATION_SEVERITIES.WARNING,
            message:
              `${stepLabel} has a decision branch to ` +
              `${normalizedTargetStepId} without a connector label.`,
            stepId,
          })
        );
      }
    });

    // Decisions normally require two or more distinct outcomes.
    if (
      normalizedStepType === PROCESS_STEP_TYPES.DECISION &&
      connections.length < 2
    ) {
      issues.push(
        createValidationIssue({
          code: "INCOMPLETE_DECISION_PATHS",
          severity: VALIDATION_SEVERITIES.WARNING,
          message: `${stepLabel} should have at least two outgoing paths.`,
          stepId,
        })
      );
    }

    // End steps terminate the flow and must not contain outgoing connections.
    if (
      normalizedStepType === PROCESS_STEP_TYPES.END &&
      connections.length > 0
    ) {
      issues.push(
        createValidationIssue({
          code: "END_STEP_HAS_OUTGOING_PATH",
          severity: VALIDATION_SEVERITIES.ERROR,
          message:
            `${stepLabel} is an end step but still has an outgoing path.`,
          stepId,
        })
      );
    }

    // Start, process, and decision steps normally require a following step.
    if (
      normalizedStepType !== PROCESS_STEP_TYPES.END &&
      supportedStepTypes.includes(normalizedStepType) &&
      connections.length === 0
    ) {
      issues.push(
        createValidationIssue({
          code: "MISSING_OUTGOING_PATH",
          severity: VALIDATION_SEVERITIES.WARNING,
          message: `${stepLabel} does not connect to another step.`,
          stepId,
        })
      );
    }
  });

  // A valid process should contain at least one explicit starting point.
  if (startStepCount === 0) {
    issues.push(
      createValidationIssue({
        code: "MISSING_START_STEP",
        severity: VALIDATION_SEVERITIES.ERROR,
        message: "The process does not contain a start step.",
      })
    );
  }

  // Multiple starts may be intentional, but they require review.
  if (startStepCount > 1) {
    issues.push(
      createValidationIssue({
        code: "MULTIPLE_START_STEPS",
        severity: VALIDATION_SEVERITIES.WARNING,
        message: `The process contains ${startStepCount} start steps.`,
      })
    );
  }

  // A valid process should contain at least one explicit ending point.
  if (endStepCount === 0) {
    issues.push(
      createValidationIssue({
        code: "MISSING_END_STEP",
        severity: VALIDATION_SEVERITIES.ERROR,
        message: "The process does not contain an end step.",
      })
    );
  }

  return issues;
};

export {
  PROCESS_STEP_TYPES,
  VALIDATION_SEVERITIES,
  createStepIdSet,
  getStepConnections,
  hasUsableText,
  validateProcessModel,
};