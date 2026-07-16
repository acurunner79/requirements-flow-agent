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
// Unreachable Process Step Detection
// ========================================

/**
 * Finds process steps that cannot be reached from the single start step.
 *
 * The function performs a graph traversal beginning at the start step and
 * follows every normalized connection target. Any step not visited during that
 * traversal is considered unreachable.
 *
 * Returned IDs preserve the original process-model order so generated warnings
 * and user-facing diagnostics remain deterministic.
 *
 * @param {Array<{
 *   id: string,
 *   type: string,
 *   connections: Array<{ targetStepId: string }>
 * }>} steps
 * Normalized process steps with validated identifiers and connection targets.
 *
 * @returns {string[]}
 * IDs of process steps that cannot be reached from the start step.
 */
const findUnreachableProcessStepIds = (steps) => {
  const startStep = steps.find(
    (step) => step.type === "start"
  );

  if (!startStep) {
    return steps.map((step) => step.id);
  }

  const stepsById = new Map(
    steps.map((step) => [
      step.id,
      step,
    ])
  );

  const reachableStepIds = new Set();
  const pendingStepIds = [
    startStep.id,
  ];

  while (pendingStepIds.length > 0) {
    const currentStepId =
      pendingStepIds.pop();

    if (reachableStepIds.has(currentStepId)) {
      continue;
    }

    reachableStepIds.add(currentStepId);

    const currentStep =
      stepsById.get(currentStepId);

    if (!currentStep) {
      continue;
    }

    currentStep.connections.forEach((connection) => {
      if (
        !reachableStepIds.has(
          connection.targetStepId
        )
      ) {
        pendingStepIds.push(
          connection.targetStepId
        );
      }
    });
  }

  return steps
    .filter(
      (step) =>
        !reachableStepIds.has(step.id)
    )
    .map((step) => step.id);
};

// ========================================
// Disconnected Workflow Section Detection
// ========================================

/**
 * Finds workflow sections that are disconnected from the primary section
 * containing the single start step.
 *
 * Connections are treated as undirected for this quality check. This allows
 * the detector to identify separate workflow islands even when their internal
 * connections point only in one direction.
 *
 * Each returned section preserves the original process-model step order.
 * Sections are also returned in the order their first step appears.
 *
 * @param {Array<{
 *   id: string,
 *   type: string,
 *   connections: Array<{ targetStepId: string }>
 * }>} steps
 * Normalized process steps with validated identifiers and connection targets.
 *
 * @returns {string[][]}
 * Disconnected workflow sections represented as ordered step-ID collections.
 */
const findDisconnectedProcessSections = (steps) => {
  const startStep = steps.find(
    (step) => step.type === "start"
  );

  if (!startStep) {
    return [];
  }

  const stepOrder = new Map(
    steps.map((step, index) => [
      step.id,
      index,
    ])
  );

  const adjacentStepIds = new Map(
    steps.map((step) => [
      step.id,
      new Set(),
    ])
  );

  /**
   * Build an undirected adjacency map so connected workflow islands can be
   * detected regardless of connection direction.
   */
  steps.forEach((step) => {
    step.connections.forEach((connection) => {
      adjacentStepIds
        .get(step.id)
        .add(connection.targetStepId);

      adjacentStepIds
        .get(connection.targetStepId)
        .add(step.id);
    });
  });

  const visitedStepIds = new Set();

  /**
   * Traverses one complete connected section beginning with the supplied step.
   *
   * @param {string} initialStepId
   * First step in the section.
   *
   * @returns {string[]}
   * IDs belonging to the connected section.
   */
  const collectSectionStepIds = (
    initialStepId
  ) => {
    const sectionStepIds = [];
    const pendingStepIds = [
      initialStepId,
    ];

    while (pendingStepIds.length > 0) {
      const currentStepId =
        pendingStepIds.pop();

      if (visitedStepIds.has(currentStepId)) {
        continue;
      }

      visitedStepIds.add(currentStepId);
      sectionStepIds.push(currentStepId);

      adjacentStepIds
        .get(currentStepId)
        .forEach((adjacentStepId) => {
          if (!visitedStepIds.has(adjacentStepId)) {
            pendingStepIds.push(adjacentStepId);
          }
        });
    }

    return sectionStepIds.sort(
      (firstStepId, secondStepId) =>
        stepOrder.get(firstStepId) -
        stepOrder.get(secondStepId)
    );
  };

  /**
   * Mark the section containing the start step as the primary workflow.
   */
  collectSectionStepIds(startStep.id);

  const disconnectedSections = [];

  steps.forEach((step) => {
    if (visitedStepIds.has(step.id)) {
      return;
    }

    disconnectedSections.push(
      collectSectionStepIds(step.id)
    );
  });

  return disconnectedSections;
};

// ========================================
// Unexpected Dead-End Detection
// ========================================

/**
 * Finds non-terminal process steps that have no outgoing connections.
 *
 * End steps are valid terminal outcomes and are intentionally excluded. Any
 * other step type without a connection is considered an unexpected dead end
 * that should be reviewed.
 *
 * Returned IDs preserve the original process-model order.
 *
 * @param {Array<{
 *   id: string,
 *   type: string,
 *   connections: Array<{ targetStepId: string }>
 * }>} steps
 * Normalized process steps.
 *
 * @returns {string[]}
 * IDs of non-end steps with no outgoing connections.
 */
const findUnexpectedDeadEndStepIds = (steps) => {
  return steps
    .filter(
      (step) =>
        step.type !== "end" &&
        step.connections.length === 0
    )
    .map((step) => step.id);
};

// ========================================
// Unreachable End-Step Detection
// ========================================

/**
 * Finds end steps that cannot be reached from the single start step.
 *
 * This quality check reuses the general unreachable-step detector and narrows
 * the result to terminal outcomes. Returned IDs preserve the original
 * process-model order.
 *
 * @param {Array<{
 *   id: string,
 *   type: string,
 *   connections: Array<{ targetStepId: string }>
 * }>} steps
 * Normalized process steps.
 *
 * @returns {string[]}
 * IDs of unreachable end steps.
 */
const findUnreachableEndStepIds = (steps) => {
  const unreachableStepIds = new Set(
    findUnreachableProcessStepIds(steps)
  );

  return steps
    .filter(
      (step) =>
        step.type === "end" &&
        unreachableStepIds.has(step.id)
    )
    .map((step) => step.id);
};

// ========================================
// Circular Process Path Detection
// ========================================

/**
 * Finds groups of process steps that participate in directed cycles.
 *
 * Strongly connected components are used so steps that merely lead into or out
 * of a cycle are not included. Components containing multiple steps are
 * circular. A single step is circular only when it connects to itself.
 *
 * Step IDs within each group and the groups themselves preserve the original
 * process-model order.
 *
 * @param {Array<{
 *   id: string,
 *   connections: Array<{ targetStepId: string }>
 * }>} steps
 * Normalized process steps.
 *
 * @returns {string[][]}
 * Ordered groups of step IDs participating in circular paths.
 */
const findCircularProcessStepGroups = (steps) => {
  const stepOrder = new Map(
    steps.map((step, index) => [
      step.id,
      index,
    ])
  );

  const stepById = new Map(
    steps.map((step) => [
      step.id,
      step,
    ])
  );

  const discoveryIndexes = new Map();
  const lowLinkIndexes = new Map();
  const activeStepIds = new Set();
  const traversalStack = [];
  const circularGroups = [];

  let nextDiscoveryIndex = 0;

  /**
   * Performs Tarjan's strongly connected component traversal from one step.
   *
   * @param {string} stepId
   * Current step identifier.
   *
   * @returns {void}
   */
  const visitStep = (stepId) => {
    discoveryIndexes.set(
      stepId,
      nextDiscoveryIndex
    );

    lowLinkIndexes.set(
      stepId,
      nextDiscoveryIndex
    );

    nextDiscoveryIndex += 1;

    traversalStack.push(stepId);
    activeStepIds.add(stepId);

    const step = stepById.get(stepId);

    step.connections.forEach((connection) => {
      const targetStepId =
        connection.targetStepId;

      if (!stepById.has(targetStepId)) {
        return;
      }

      if (!discoveryIndexes.has(targetStepId)) {
        visitStep(targetStepId);

        lowLinkIndexes.set(
          stepId,
          Math.min(
            lowLinkIndexes.get(stepId),
            lowLinkIndexes.get(targetStepId)
          )
        );

        return;
      }

      if (activeStepIds.has(targetStepId)) {
        lowLinkIndexes.set(
          stepId,
          Math.min(
            lowLinkIndexes.get(stepId),
            discoveryIndexes.get(targetStepId)
          )
        );
      }
    });

    const isComponentRoot =
      lowLinkIndexes.get(stepId) ===
      discoveryIndexes.get(stepId);

    if (!isComponentRoot) {
      return;
    }

    const componentStepIds = [];
    let componentStepId;

    do {
      componentStepId =
        traversalStack.pop();

      activeStepIds.delete(componentStepId);
      componentStepIds.push(componentStepId);
    } while (componentStepId !== stepId);

    const orderedComponentStepIds =
      componentStepIds.sort(
        (firstStepId, secondStepId) =>
          stepOrder.get(firstStepId) -
          stepOrder.get(secondStepId)
      );

    const containsMultipleSteps =
      orderedComponentStepIds.length > 1;

    const containsSelfConnection =
      orderedComponentStepIds.length === 1 &&
      stepById
        .get(orderedComponentStepIds[0])
        .connections.some(
          (connection) =>
            connection.targetStepId ===
            orderedComponentStepIds[0]
        );

    if (
      containsMultipleSteps ||
      containsSelfConnection
    ) {
      circularGroups.push(
        orderedComponentStepIds
      );
    }
  };

  steps.forEach((step) => {
    if (!discoveryIndexes.has(step.id)) {
      visitStep(step.id);
    }
  });

  return circularGroups.sort(
    (firstGroup, secondGroup) =>
      stepOrder.get(firstGroup[0]) -
      stepOrder.get(secondGroup[0])
  );
};

// ========================================
// Decision Branch Count Detection
// ========================================

/**
 * Finds decision steps that have fewer than two outgoing branches.
 *
 * A valid decision should provide at least two possible outcomes. Returned IDs
 * preserve the original process-model order.
 *
 * @param {Array<{
 *   id: string,
 *   type: string,
 *   connections: Array<{ targetStepId: string }>
 * }>} steps
 * Normalized process steps.
 *
 * @returns {string[]}
 * IDs of decision steps with insufficient outgoing branches.
 */
const findDecisionStepIdsWithInsufficientBranches = (steps) => {
  return steps
    .filter(
      (step) =>
        step.type === "decision" &&
        step.connections.length < 2
    )
    .map((step) => step.id);
};

// ========================================
// Decision Branch Label Detection
// ========================================

/**
 * Finds decision steps containing duplicate or unlabeled outgoing branches.
 *
 * Duplicate comparisons ignore capitalization and surrounding whitespace while
 * preserving the first readable label for warning output.
 *
 * @param {Array<{
 *   id: string,
 *   type: string,
 *   connections: Array<{
 *     targetStepId: string,
 *     label: string
 *   }>
 * }>} steps
 * Normalized process steps.
 *
 * @returns {Array<{
 *   stepId: string,
 *   duplicateLabels: string[],
 *   unlabeledBranchCount: number
 * }>}
 * Ordered decision-branch label issues.
 */
const findDecisionBranchLabelIssues = (steps) => {
  return steps
    .filter((step) => step.type === "decision")
    .map((step) => {
      const readableLabelByNormalizedValue =
        new Map();

      const duplicateNormalizedLabels =
        new Set();

      let unlabeledBranchCount = 0;

      step.connections.forEach((connection) => {
        const readableLabel =
          typeof connection.label === "string"
            ? connection.label.trim()
            : "";

        if (!readableLabel) {
          unlabeledBranchCount += 1;
          return;
        }

        const normalizedLabel =
          readableLabel.toLowerCase();

        if (
          readableLabelByNormalizedValue.has(
            normalizedLabel
          )
        ) {
          duplicateNormalizedLabels.add(
            normalizedLabel
          );

          return;
        }

        readableLabelByNormalizedValue.set(
          normalizedLabel,
          readableLabel
        );
      });

      const duplicateLabels = Array.from(
        duplicateNormalizedLabels
      ).map((normalizedLabel) =>
        readableLabelByNormalizedValue.get(
          normalizedLabel
        )
      );

      return {
        stepId: step.id,
        duplicateLabels,
        unlabeledBranchCount,
      };
    })
    .filter(
      (issue) =>
        issue.duplicateLabels.length > 0 ||
        issue.unlabeledBranchCount > 0
    );
};

// ========================================
// Unused Actor Detection
// ========================================

/**
 * Finds actors that are listed in the process model but are not assigned as the
 * owner of any process step.
 *
 * Actor comparisons ignore capitalization and surrounding whitespace while
 * returned names preserve the original actor-list order and formatting.
 *
 * @param {string[]} actors
 * Normalized process actors.
 *
 * @param {Array<{
 *   owner: string
 * }>} steps
 * Normalized process steps.
 *
 * @returns {string[]}
 * Ordered actor names that are not used by any process step.
 */
const findUnusedActors = (actors, steps) => {
  const usedActorNames = new Set(
    steps
      .map((step) =>
        typeof step.owner === "string"
          ? step.owner.trim().toLowerCase()
          : ""
      )
      .filter(Boolean)
  );

  return actors.filter((actor) => {
    const normalizedActor =
      typeof actor === "string"
        ? actor.trim().toLowerCase()
        : "";

    return (
      normalizedActor &&
      !usedActorNames.has(normalizedActor)
    );
  });
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

    /**
   * Ensure the process has one unambiguous entry point.
   */
  const startSteps = steps.filter(
    (step) => step.type === "start"
  );

  if (startSteps.length === 0) {
    throw new Error(
      "The AI provider response must contain one start process step."
    );
  }

  if (startSteps.length > 1) {
    throw new Error(
      "The AI provider response must not contain multiple start process steps."
    );
  }

  /**
   * Ensure the process contains at least one terminal outcome.
   *
   * Multiple end steps are valid because decision branches may conclude with
   * different business outcomes.
   */
  const containsEndStep = steps.some(
    (step) => step.type === "end"
  );

  if (!containsEndStep) {
    throw new Error(
      "The AI provider response must contain at least one end process step."
    );
  }
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

  /**
   * Preserve provider-generated warnings before adding deterministic
   * process-quality warnings discovered during backend analysis.
   */
  const normalizedWarnings = normalizeWarnings(
    parsedResponse.warnings
  );

  const unreachableStepIds =
    findUnreachableProcessStepIds(
      normalizedSteps
    );

  if (unreachableStepIds.length > 0) {
    normalizedWarnings.push({
      code: "UNREACHABLE_PROCESS_STEPS",
      message:
        `The following process steps cannot be reached from the start step: ${unreachableStepIds.join(
          ", "
        )}.`,
    });
  }

  const disconnectedSections =
    findDisconnectedProcessSections(
      normalizedSteps
    );

  disconnectedSections.forEach(
    (sectionStepIds, index) => {
      normalizedWarnings.push({
        code:
          `DISCONNECTED_PROCESS_SECTION_${String(
            index + 1
          ).padStart(3, "0")}`,
        message:
          `The following process steps form a disconnected workflow section: ${sectionStepIds.join(
            ", "
          )}.`,
      });
    }
  );

    /**
   * Surface non-terminal steps that unexpectedly stop without an outgoing
   * connection.
   */
  const unexpectedDeadEndStepIds =
    findUnexpectedDeadEndStepIds(
      normalizedSteps
    );

  if (unexpectedDeadEndStepIds.length > 0) {
    normalizedWarnings.push({
      code: "UNEXPECTED_PROCESS_DEAD_ENDS",
      message:
        `The following non-terminal process steps have no outgoing connections: ${unexpectedDeadEndStepIds.join(
          ", "
        )}.`,
    });
  }

  /**
   * Surface terminal outcomes that exist in the model but cannot be reached
   * from the process start.
   */
  const unreachableEndStepIds =
    findUnreachableEndStepIds(
      normalizedSteps
    );

  if (unreachableEndStepIds.length > 0) {
    normalizedWarnings.push({
      code: "UNREACHABLE_END_STEPS",
      message:
        `The following end process steps cannot be reached from the start step: ${unreachableEndStepIds.join(
          ", "
        )}.`,
    });
  }

  /**
   * Surface circular process paths for human review.
   *
   * Some loops are intentional, such as revision or retry paths, so circular
   * groups are preserved and reported as warnings instead of rejected.
   */
  const circularProcessStepGroups =
    findCircularProcessStepGroups(
      normalizedSteps
    );

  circularProcessStepGroups.forEach(
    (groupStepIds, index) => {
      normalizedWarnings.push({
        code:
          `CIRCULAR_PROCESS_PATH_${String(
            index + 1
          ).padStart(3, "0")}`,
        message:
          `The following process steps form a circular path that should be reviewed: ${groupStepIds.join(
            ", "
          )}.`,
      });
    }
  );

  /**
   * Surface decision steps that do not provide enough outgoing outcomes.
   */
  const decisionStepIdsWithInsufficientBranches =
    findDecisionStepIdsWithInsufficientBranches(
      normalizedSteps
    );

  if (
    decisionStepIdsWithInsufficientBranches.length > 0
  ) {
    normalizedWarnings.push({
      code: "INSUFFICIENT_DECISION_BRANCHES",
      message:
        `The following decision process steps have fewer than two outgoing branches: ${decisionStepIdsWithInsufficientBranches.join(
          ", "
        )}.`,
    });
  }

  /**
   * Surface duplicate and unlabeled decision-branch labels for review.
   */
  const decisionBranchLabelIssues =
    findDecisionBranchLabelIssues(
      normalizedSteps
    );

  decisionBranchLabelIssues.forEach((issue) => {
    if (issue.duplicateLabels.length > 0) {
      normalizedWarnings.push({
        code:
          `DUPLICATE_DECISION_BRANCH_LABELS_${issue.stepId}`,
        message:
          `Decision step ${issue.stepId} contains duplicate branch labels: ${issue.duplicateLabels.join(
            ", "
          )}.`,
      });
    }

    if (issue.unlabeledBranchCount > 0) {
      const branchWord =
        issue.unlabeledBranchCount === 1
          ? "branch"
          : "branches";

      normalizedWarnings.push({
        code:
          `UNLABELED_DECISION_BRANCHES_${issue.stepId}`,
        message:
          `Decision step ${issue.stepId} contains ${issue.unlabeledBranchCount} unlabeled outgoing ${branchWord}.`,
      });
    }
  });

  

  const normalizedActors = normalizeActors(
    parsedResponse.actors
  );

  const encounteredActors = new Set(
    normalizedActors.map((actor) => actor.toLowerCase())
  );

  /**
   * Surface actors that are listed in the process model but are not assigned to
   * any normalized process step.
   */
  const unusedActors = findUnusedActors(
    normalizedActors,
    normalizedSteps
  );

  if (unusedActors.length > 0) {
    normalizedWarnings.push({
      code: "UNUSED_PROCESS_ACTORS",
      message:
        `The following process actors are not assigned to any process step: ${unusedActors.join(
          ", "
        )}.`,
    });
  }

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

    warnings: normalizedWarnings,
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
  findUnreachableProcessStepIds,
  findDisconnectedProcessSections,
  findUnexpectedDeadEndStepIds,
  findUnreachableEndStepIds,
  findCircularProcessStepGroups,
  findDecisionStepIdsWithInsufficientBranches,
  findDecisionBranchLabelIssues,
  findUnusedActors,
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