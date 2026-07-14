// ========================================
// Process Model Utilities
// ========================================

/**
 * Determines whether a value contains usable text.
 *
 * This small shared helper keeps validation behavior consistent when
 * normalizing step identifiers, actor names, process names, and connections.
 *
 * @param {unknown} value
 * Value to inspect.
 *
 * @returns {boolean}
 * True when the value is a non-empty string after trimming.
 */
const hasUsableText = (value) => {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
};

// ========================================
// Process Connection Helpers
// ========================================

/**
 * Normalizes a collection of rich process connections.
 *
 * `connections` is the primary outgoing-path structure used by the frontend.
 * Each valid connection contains:
 *
 * - `targetStepId`: Identifier of the destination process step
 * - `label`: Optional connector text such as Yes, No, Approved, or Rejected
 *
 * Invalid entries without a usable target are removed because they cannot
 * produce a valid process connector.
 *
 * Duplicate target-and-label combinations are also removed while preserving
 * the order of the first occurrence.
 *
 * @param {Array<object>} connections
 * Raw outgoing connections to normalize.
 *
 * @returns {Array<object>}
 * Normalized and deduplicated rich connection objects.
 *
 * @throws {Error}
 * Throws when the supplied value is not an array.
 */
const normalizeProcessConnections = (connections) => {
  if (!Array.isArray(connections)) {
    throw new Error(
      "A valid connection array is required."
    );
  }

  const normalizedConnections = [];
  const encounteredConnections = new Set();

  connections.forEach((connection) => {
    if (
      !connection ||
      typeof connection !== "object" ||
      Array.isArray(connection) ||
      !hasUsableText(connection.targetStepId)
    ) {
      return;
    }

    const normalizedConnection = {
      targetStepId: connection.targetStepId.trim(),
      label: hasUsableText(connection.label)
        ? connection.label.trim()
        : "",
    };

    /**
     * The target-and-label combination identifies one connector.
     *
     * This still permits two differently labeled branches to reach the same
     * destination when the business process requires that structure.
     */
    const connectionKey = [
      normalizedConnection.targetStepId,
      normalizedConnection.label.toLowerCase(),
    ].join("::");

    if (encounteredConnections.has(connectionKey)) {
      return;
    }

    encounteredConnections.add(connectionKey);
    normalizedConnections.push(normalizedConnection);
  });

  return normalizedConnections;
};

/**
 * Creates normalized connection updates for storage on a process step.
 *
 * Rich `connections` objects are the authoritative outgoing-path
 * representation throughout the frontend.
 *
 * @param {Array<object>} connections
 * Raw outgoing connection collection.
 *
 * @returns {{
 *   connections: Array<object>
 * }}
 * Normalized rich connection data.
 */
const createConnectionUpdates = (connections) => {
  return {
    connections: normalizeProcessConnections(connections),
  };
};

// ========================================
// Process Step Updates
// ========================================

/**
 * Returns a new process model with one process step updated.
 *
 * This utility performs an immutable update rather than modifying the original
 * process model directly. React state should be treated as immutable so it can
 * reliably detect changes and rerender affected components.
 *
 * When the updates object contains `connections`, those connections are
 * normalized automatically before being stored on the process step.
 *
 * @param {object} processModel
 * Complete structured process model currently stored in application state.
 *
 * @param {string} stepId
 * Unique identifier of the process step that should be updated.
 *
 * @param {object} updates
 * Partial step object containing only the properties that should change.
 *
 * @returns {object}
 * New process model containing the updated step.
 *
 * @throws {Error}
 * Throws when the process model, step identifier, or updates object is invalid.
 */
const updateProcessStep = (
  processModel,
  stepId,
  updates
) => {
  if (!processModel || !Array.isArray(processModel.steps)) {
    throw new Error(
      "A valid process model with a steps array is required."
    );
  }

  if (!hasUsableText(stepId)) {
    throw new Error(
      "A valid process step ID is required."
    );
  }

  if (
    !updates ||
    typeof updates !== "object" ||
    Array.isArray(updates)
  ) {
    throw new Error(
      "A valid process-step updates object is required."
    );
  }

  /**
 * Rich connection edits are normalized through the centralized connection
 * helper before being stored in the process model.
 */
  const normalizedUpdates =
    Object.prototype.hasOwnProperty.call(
      updates,
      "connections"
    )
      ? {
          ...updates,
          ...createConnectionUpdates(
            updates.connections
          ),
        }
      : updates;

  return {
    ...processModel,

    steps: processModel.steps.map((step) => {
      if (step.id !== stepId) {
        return step;
      }

      return {
        ...step,
        ...normalizedUpdates,
      };
    }),
  };
};

// ========================================
// Process Name Updates
// ========================================

/**
 * Returns a new process model with an updated process name.
 *
 * @param {object} processModel
 * Complete structured process model currently stored in application state.
 *
 * @param {string} processName
 * Validated process name that should replace the current value.
 *
 * @returns {object}
 * New process model containing the updated process name.
 *
 * @throws {Error}
 * Throws when the process model or process name is invalid.
 */
const updateProcessName = (
  processModel,
  processName
) => {
  if (
    !processModel ||
    typeof processModel !== "object" ||
    Array.isArray(processModel)
  ) {
    throw new Error(
      "A valid process model is required."
    );
  }

  if (!hasUsableText(processName)) {
    throw new Error(
      "A valid process name is required."
    );
  }

  return {
    ...processModel,
    processName: processName.trim(),
  };
};

// ========================================
// Process Actor Updates
// ========================================

/**
 * Returns a new process model containing an additional actor.
 *
 * Actor order is preserved because the actor list can determine the default
 * order of swimlanes in the generated process diagram.
 *
 * @param {object} processModel
 * Complete structured process model.
 *
 * @param {string} actorName
 * Validated actor, team, system, or role to add.
 *
 * @returns {object}
 * New process model containing the added actor.
 *
 * @throws {Error}
 * Throws when the model does not contain a valid actors array or the supplied
 * actor name is invalid.
 */
const addProcessActor = (
  processModel,
  actorName
) => {
  if (!processModel || !Array.isArray(processModel.actors)) {
    throw new Error(
      "A valid process model with an actors array is required."
    );
  }

  if (!hasUsableText(actorName)) {
    throw new Error(
      "A valid actor name is required."
    );
  }

  return {
    ...processModel,
    actors: [
      ...processModel.actors,
      actorName.trim(),
    ],
  };
};

/**
 * Returns a new process model with an existing actor renamed.
 *
 * Process steps currently owned by the renamed actor are updated as well. This
 * keeps actor metadata and step ownership synchronized.
 *
 * @param {object} processModel
 * Complete structured process model.
 *
 * @param {string} currentActorName
 * Actor value currently stored in the process model.
 *
 * @param {string} updatedActorName
 * Validated replacement actor value.
 *
 * @returns {object}
 * New process model containing the renamed actor and updated step owners.
 *
 * @throws {Error}
 * Throws when the model or actor values are invalid.
 */
const updateProcessActor = (
  processModel,
  currentActorName,
  updatedActorName
) => {
  if (
    !processModel ||
    !Array.isArray(processModel.actors) ||
    !Array.isArray(processModel.steps)
  ) {
    throw new Error(
      "A valid process model with actors and steps arrays is required."
    );
  }

  if (
    !hasUsableText(currentActorName) ||
    !hasUsableText(updatedActorName)
  ) {
    throw new Error(
      "Valid current and updated actor names are required."
    );
  }

  const normalizedCurrentActorName =
    currentActorName.trim();

  const normalizedUpdatedActorName =
    updatedActorName.trim();

  return {
    ...processModel,

    actors: processModel.actors.map((actor) =>
      actor === normalizedCurrentActorName
        ? normalizedUpdatedActorName
        : actor
    ),

    steps: processModel.steps.map((step) =>
      step.owner === normalizedCurrentActorName
        ? {
            ...step,
            owner: normalizedUpdatedActorName,
          }
        : step
    ),
  };
};

/**
 * Returns a new process model with one actor removed.
 *
 * Steps owned by the removed actor are preserved but marked as "Unassigned".
 * This prevents process data from being deleted silently and identifies steps
 * that require reassignment before export.
 *
 * @param {object} processModel
 * Complete structured process model.
 *
 * @param {string} actorName
 * Actor that should be removed.
 *
 * @returns {object}
 * New process model with the actor removed and affected steps unassigned.
 *
 * @throws {Error}
 * Throws when the process model or actor name is invalid.
 */
const removeProcessActor = (
  processModel,
  actorName
) => {
  if (
    !processModel ||
    !Array.isArray(processModel.actors) ||
    !Array.isArray(processModel.steps)
  ) {
    throw new Error(
      "A valid process model with actors and steps arrays is required."
    );
  }

  if (!hasUsableText(actorName)) {
    throw new Error(
      "A valid actor name is required."
    );
  }

  const normalizedActorName = actorName.trim();

  return {
    ...processModel,

    actors: processModel.actors.filter(
      (actor) => actor !== normalizedActorName
    ),

    steps: processModel.steps.map((step) =>
      step.owner === normalizedActorName
        ? {
            ...step,
            owner: "Unassigned",
          }
        : step
    ),
  };
};

// ========================================
// Process Connection Updates
// ========================================

/**
 * Returns a new process model with updated outgoing connections for one step.
 *
 * Rich `connections` data is the authoritative editing and storage
 * representation. Connection normalization is handled by `updateProcessStep`
 * through the centralized helper above.
 *
 * @param {object} processModel
 * Complete structured process model currently stored in application state.
 *
 * @param {string} stepId
 * Unique identifier of the process step whose connections should change.
 *
 * @param {Array<object>} connections
 * Complete outgoing connection collection for the selected process step.
 *
 * @returns {object}
 * New process model containing normalized outgoing connection data.
 *
 * @throws {Error}
 * Throws when the process model, step identifier, or connection collection is
 * invalid.
 */
const updateProcessStepConnections = (
  processModel,
  stepId,
  connections
) => {
  if (!Array.isArray(connections)) {
    throw new Error(
      "A valid connection array is required."
    );
  }

  /**
 * Delegate the immutable update and connection normalization to the generic
 * step utility. This keeps all connection-writing behavior in one controlled
 * path.
 */
  return updateProcessStep(
    processModel,
    stepId,
    {
      connections,
    }
  );
};

export {
  addProcessActor,
  createConnectionUpdates,
  hasUsableText,
  normalizeProcessConnections,
  removeProcessActor,
  updateProcessActor,
  updateProcessName,
  updateProcessStep,
  updateProcessStepConnections,
};