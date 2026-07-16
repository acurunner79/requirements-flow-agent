// ========================================
// Process Diagram Layout Helpers
// ========================================

/**
 * Returns the normalized outgoing connections for a process step.
 *
 * A defensive empty-array fallback keeps layout generation safe when an
 * incomplete process step reaches the utility.
 *
 * @param {object} step
 * Process step containing outgoing connection data.
 *
 * @returns {Array<object>}
 * Normalized outgoing connection collection.
 */
const getStepConnections = (step) => {
  return Array.isArray(step.connections)
    ? step.connections
    : [];
};

/**
 * Creates a left-to-right diagram layout from process connections.
 *
 * Layout behavior:
 * - Start steps begin at column 0, row 0
 * - Connected steps are placed one column beyond their source step
 * - The first outgoing branch stays on the source row
 * - Additional outgoing branches receive increasing row positions
 * - Occupied grid positions are never reused
 * - Disconnected workflow sections follow their own connection structure
 * - Source-array order is preserved for stable output
 *
 * This is intentionally a lightweight first-pass layout engine. More advanced
 * collision handling, branch merging, connector routing, and swimlanes will be
 * added in later controlled steps.
 *
 * @param {object} processModel
 * Structured process model containing a steps collection.
 *
 * @returns {{nodes: Array<object>, edges: Array<object>}}
 * Diagram nodes with grid positions and normalized connection edges.
 */
const createProcessDiagramLayout = (processModel) => {
  const steps = Array.isArray(processModel?.steps)
    ? processModel.steps
    : [];

  const stepById = new Map(
    steps.map((step) => [
      step.id,
      step,
    ])
  );

  const nodePositions = new Map();

  /**
   * Tracks occupied grid cells so nested branches cannot place two different
   * process steps in the same diagram position.
   */
  const occupiedPositions = new Set();

  /**
   * Reserves the first available row in a requested column.
   *
   * The preferred row is used when available. When another node already
   * occupies that cell, the row advances until an open position is found.
   *
   * @param {number} column
   * Requested diagram column.
   *
   * @param {number} preferredRow
   * First row position to attempt.
   *
   * @returns {{column: number, row: number}}
   * Unique diagram position.
   */
  const reservePosition = (column, preferredRow) => {
    let row = preferredRow;

    while (occupiedPositions.has(`${column}:${row}`)) {
      row += 1;
    }

    occupiedPositions.add(`${column}:${row}`);

    return {
      column,
      row,
    };
  };

  /**
   * Traverses and positions one connected workflow section.
   *
   * The section origin may be the primary start step or the first unpositioned
   * step in a disconnected workflow section.
   *
   * @param {string} startingStepId
   * Step identifier used as the section origin.
   *
   * @param {number} startingColumn
   * Column assigned to the section origin.
   *
   * @param {number} startingRow
   * Preferred row assigned to the section origin.
   *
   * @returns {void}
   */
  const layoutWorkflowSection = (
    startingStepId,
    startingColumn,
    startingRow
  ) => {
    if (
      !stepById.has(startingStepId) ||
      nodePositions.has(startingStepId)
    ) {
      return;
    }

    nodePositions.set(
      startingStepId,
      reservePosition(startingColumn, startingRow)
    );

    const pendingStepIds = [
      startingStepId,
    ];

    while (pendingStepIds.length > 0) {
      const sourceStepId = pendingStepIds.shift();
      const sourceStep = stepById.get(sourceStepId);
      const sourcePosition = nodePositions.get(sourceStepId);

      if (!sourceStep || !sourcePosition) {
        continue;
      }

      getStepConnections(sourceStep).forEach(
        (connection, branchIndex) => {
          const targetStepId = connection.targetStepId;

          if (
            !stepById.has(targetStepId) ||
            nodePositions.has(targetStepId)
          ) {
            return;
          }

          nodePositions.set(
            targetStepId,
            reservePosition(
              sourcePosition.column + 1,
              sourcePosition.row + branchIndex
            )
          );

          pendingStepIds.push(targetStepId);
        }
      );
    }
  };

  /**
   * Prefer the explicit start step as the primary layout origin.
   *
   * Falling back to the first step keeps the utility usable for incomplete
   * process models while validation continues to surface the missing start.
   */
  const startingStep =
    steps.find((step) => step.type === "start") ||
    steps[0];

  if (startingStep) {
    layoutWorkflowSection(
      startingStep.id,
      0,
      0
    );
  }


    /**
     * Lay out every remaining disconnected workflow section.
     *
     * Prefer a step with no incoming connection from another unpositioned step as
     * the section origin. This prevents a downstream step from being positioned
     * before its disconnected section's actual source merely because it appears
     * earlier in the source array.
     */
    while (nodePositions.size < steps.length) {
        const unpositionedSteps = steps.filter(
            (step) => !nodePositions.has(step.id)
        );

        const unpositionedStepIds = new Set(
            unpositionedSteps.map((step) => step.id)
        );

        const incomingTargetIds = new Set();

        unpositionedSteps.forEach((step) => {
            getStepConnections(step).forEach((connection) => {
            if (unpositionedStepIds.has(connection.targetStepId)) {
                incomingTargetIds.add(connection.targetStepId);
            }
            });
        });

        /**
         * Prefer a true section source.
         *
         * Cycles may not contain a node without an incoming edge, so fall back to the
         * first unpositioned step to guarantee progress.
         */
        const sectionStartingStep =
            unpositionedSteps.find(
            (step) => !incomingTargetIds.has(step.id)
            ) ||
            unpositionedSteps[0];

        const occupiedColumns = Array.from(
            nodePositions.values(),
            (position) => position.column
        );

        const sectionStartColumn =
            occupiedColumns.length > 0
            ? Math.max(...occupiedColumns) + 1
            : 0;

        layoutWorkflowSection(
            sectionStartingStep.id,
            sectionStartColumn,
            0
        );
    }

  const nodes = steps.map((step) => {
    const position = nodePositions.get(step.id);

    return {
      stepId: step.id,
      column: position.column,
      row: position.row,
    };
  });

  const edges = steps.flatMap((step) => {
    return getStepConnections(step).map((connection) => ({
      sourceStepId: step.id,
      targetStepId: connection.targetStepId,
      label:
        typeof connection.label === "string"
          ? connection.label
          : "",
    }));
  });

  return {
    nodes,
    edges,
  };
};

export {
  createProcessDiagramLayout,
  getStepConnections,
};