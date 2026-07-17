import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createProcessDiagramLayout } from "../../utils/processDiagramLayoutUtils";

// ========================================
// Process Diagram Preview Component
// ========================================

/**
 * Renders a visual preview of the current process model.
 *
 * The preview presents:
 * - Actor-based swimlanes
 * - Automatically positioned process nodes
 * - Measured orthogonal connectors between related steps
 *
 * Connector positions are calculated from the rendered node elements so the
 * lines remain aligned when the workspace width or node dimensions change.
 *
 * @param {object} props
 * Component properties.
 *
 * @param {object} props.processModel
 * Current process model containing actors, steps, and connections.
 *
 * @returns {JSX.Element}
 * Process diagram preview.
 */
const ProcessDiagramPreview = ({
  processModel,
  validationIssues = [],
  selectedStepId,
  onStepSelect,
}) => {
  /**
   * Store references to the diagram surface and rendered process nodes.
   *
   * Connector geometry is calculated from the browser's measured element
   * positions so lines remain aligned when the workspace width changes.
   */
  const surfaceRef = useRef(null);

  const nodeElementsRef = useRef(
    new Map()
  );

  /**
   * Reference the stationary viewport so fit-to-screen calculations can compare
   * its available space with the full diagram dimensions.
   */
  const viewportRef = useRef(null);


  const [
    connectorPaths,
    setConnectorPaths,
  ] = useState([]);

  /**
   * Group validation issues by process step so diagram nodes can surface the
   * most important visual state without repeatedly filtering the full issue
   * collection during rendering.
   */
  const validationSeverityByStepId = useMemo(() => {
    const severityByStepId = new Map();

    validationIssues.forEach((issue) => {
      if (!issue?.stepId) {
        return;
      }

      const currentSeverity =
        severityByStepId.get(issue.stepId);

      if (
        issue.severity === "error" ||
        !currentSeverity
      ) {
        severityByStepId.set(
          issue.stepId,
          issue.severity
        );
      }
    });

    return severityByStepId;
  }, [validationIssues]);

  /**
   * Track the current diagram zoom level as a percentage-based scale value.
   *
   * The initial value of 1 represents 100% zoom.
   */
  const [zoomLevel, setZoomLevel] = useState(1);

  /**
   * Store the diagram translation offset used for drag-based panning.
   */
  const [panOffset, setPanOffset] = useState({
    x: 0,
    y: 0,
  });

    /**
   * Move the diagram by a consistent distance when users choose one of the
   * directional navigation controls.
   */
  const PAN_STEP = 80;

  /**
   * Track the active drag operation without forcing unnecessary renders for
   * every pointer coordinate captured during the interaction.
   */
  const dragStateRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  });

  /**
   * Recalculate the diagram layout only when the process model changes.
   *
   * Stable layout arrays prevent connector measurement effects from running
   * again merely because connector path state caused a component render.
   */
  const layout = useMemo(
    () => createProcessDiagramLayout(
      processModel
    ),
    [
      processModel,
    ]
  );

  const steps = Array.isArray(processModel?.steps)
    ? processModel.steps
    : [];

  const stepById = new Map(
    steps.map((step) => [
      step.id,
      step,
    ])
  );

  /**
   * Determine how many workflow columns the diagram surface must provide.
   *
   * The layout utility uses zero-based column indexes. Adding one converts the
   * highest position into the total number of columns required by the CSS grid.
   */
  const columnCount =
    layout.nodes.length > 0
      ? Math.max(
          ...layout.nodes.map(
            (node) => node.column
          )
        ) + 1
      : 1;

  /**
   * Measure every connected source and target node after the diagram renders.
   *
   * Each connector begins at the horizontal center of the source node's right
   * edge and ends at the horizontal center of the target node's left edge.
   * Coordinates are stored relative to the diagram surface for SVG rendering.
   */
  useLayoutEffect(() => {
    const surfaceElement =
      surfaceRef.current;

    if (!surfaceElement) {
      setConnectorPaths([]);
      return undefined;
    }

   
    const calculateConnectorPaths = () => {
      const surfaceBounds =
        surfaceElement.getBoundingClientRect();

      const nextConnectorPaths = layout.edges
        .map((edge) => {
          const sourceElement =
            nodeElementsRef.current.get(
              edge.sourceStepId
            );

          const targetElement =
            nodeElementsRef.current.get(
              edge.targetStepId
            );

          if (
            !sourceElement ||
            !targetElement
          ) {
            return null;
          }

          const sourceBounds =
            sourceElement.getBoundingClientRect();

          const targetBounds =
            targetElement.getBoundingClientRect();

          const startX =
            sourceBounds.right -
            surfaceBounds.left;

          const startY =
            sourceBounds.top -
            surfaceBounds.top +
            sourceBounds.height / 2;

          const endX =
            targetBounds.left -
            surfaceBounds.left;

          const endY =
            targetBounds.top -
            surfaceBounds.top +
            targetBounds.height / 2;

          /**
           * Use an orthogonal path with a shared midpoint so connections remain
           * easy to follow across actors and workflow rows.
           */
          const midpointX =
            startX +
            (endX - startX) / 2;

            return {
            ...edge,

            /**
             * Store the orthogonal SVG path connecting the measured source and
             * target process nodes.
             */
            path: [
              `M ${startX} ${startY}`,
              `L ${midpointX} ${startY}`,
              `L ${midpointX} ${endY}`,
              `L ${endX} ${endY}`,
            ].join(" "),

            /**
             * Place branch text near the center of the connector's vertical
             * routing segment so labels remain associated with their path.
             */
            labelX: midpointX,
            labelY:
              startY +
              (endY - startY) / 2,
          };
        })
        .filter(Boolean);

      setConnectorPaths(
        nextConnectorPaths
      );
    };

    calculateConnectorPaths();

    /**
     * ResizeObserver is available in modern browsers but may be absent from
     * lightweight test environments. The initial measurement still runs in
     * either case.
     */
    if (
      typeof ResizeObserver === "undefined"
    ) {
      return undefined;
    }

    const resizeObserver =
      new ResizeObserver(
        calculateConnectorPaths
      );

    resizeObserver.observe(
      surfaceElement
    );

    return () => {
      resizeObserver.disconnect();
    };
  }, [
    layout.edges,
    layout.nodes,
  ]);

  /**
   * Increase the diagram scale in controlled 10% increments.
   */
  const handleZoomIn = () => {
    setZoomLevel((currentZoomLevel) => {
      return Math.min(currentZoomLevel + 0.1, 2);
    });
  };

  /**
   * Decrease the diagram scale in controlled 10% increments.
   */
  const handleZoomOut = () => {
    setZoomLevel((currentZoomLevel) => {
      return Math.max(currentZoomLevel - 0.1, 0.5);
    });
  };

  /**
   * Restore the diagram to its default scale.
   */
    /**
   * Restore the diagram to its default scale and centered translation.
   */
  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({
      x: 0,
      y: 0,
    });
  };

    /**
   * Begin tracking a mouse-driven pan interaction.
   */
  const handlePanStart = (event) => {
    dragStateRef.current = {
      isDragging: true,
      startX: event.clientX,
      startY: event.clientY,
      initialPanX: panOffset.x,
      initialPanY: panOffset.y,
    };
  };

  /**
   * Translate the diagram by the distance moved since the drag began.
   */
  const handlePanMove = (event) => {
    if (!dragStateRef.current.isDragging) {
      return;
    }

    setPanOffset({
      x:
        dragStateRef.current.initialPanX +
        event.clientX -
        dragStateRef.current.startX,
      y:
        dragStateRef.current.initialPanY +
        event.clientY -
        dragStateRef.current.startY,
    });
  };

  /**
   * End the current drag interaction.
   */
  const handlePanEnd = () => {
    dragStateRef.current.isDragging = false;
  };

  /**
   * Scale the complete diagram so it fits within the visible viewport.
   *
   * The calculation preserves the diagram aspect ratio by using the smaller of
   * the horizontal and vertical scale values. Existing pan offsets are cleared
   * so the fitted diagram begins from the viewport origin.
   */
  const handleFitToScreen = () => {
    const viewportElement = viewportRef.current;
    const diagramElement = surfaceRef.current;

    if (!viewportElement || !diagramElement) {
      return;
    }

    const viewportWidth = viewportElement.clientWidth;
    const viewportHeight = viewportElement.clientHeight;
    const diagramWidth = diagramElement.scrollWidth;
    const diagramHeight = diagramElement.scrollHeight;

    /**
     * Ignore incomplete layout measurements to avoid dividing by zero or
     * applying an unusable transform during initial rendering.
     */
    if (
      viewportWidth <= 0 ||
      viewportHeight <= 0 ||
      diagramWidth <= 0 ||
      diagramHeight <= 0
    ) {
      return;
    }

    const horizontalScale = viewportWidth / diagramWidth;
    const verticalScale = viewportHeight / diagramHeight;
    const fittedScale = Math.min(
      horizontalScale,
      verticalScale,
      1
    );

    setZoomLevel(fittedScale);
    setPanOffset({
      x: 0,
      y: 0,
    });
  };

  /**
   * Move the diagram upward within the viewport.
   */
  const handleMoveUp = () => {
    setPanOffset((currentPanOffset) => {
      return {
        ...currentPanOffset,
        y: currentPanOffset.y - PAN_STEP,
      };
    });
  };

  /**
   * Move the diagram downward within the viewport.
   */
  const handleMoveDown = () => {
    setPanOffset((currentPanOffset) => {
      return {
        ...currentPanOffset,
        y: currentPanOffset.y + PAN_STEP,
      };
    });
  };

  /**
   * Move the diagram left within the viewport.
   */
  const handleMoveLeft = () => {
    setPanOffset((currentPanOffset) => {
      return {
        ...currentPanOffset,
        x: currentPanOffset.x - PAN_STEP,
      };
    });
  };

  /**
   * Move the diagram right within the viewport.
   */
  const handleMoveRight = () => {
    setPanOffset((currentPanOffset) => {
      return {
        ...currentPanOffset,
        x: currentPanOffset.x + PAN_STEP,
      };
    });
  };

  return (
    <section
      className="process-diagram-preview"
      aria-labelledby="process-diagram-preview-heading"
    >
      <header className="process-diagram-preview__header">
        <div>
          <p className="process-diagram-preview__eyebrow">
            Diagram preview
          </p>

          <h2 id="process-diagram-preview-heading">
            Process Flow
          </h2>
        </div>

        {/**
         * Provide explicit viewport controls so keyboard and assistive-
         * technology users can adjust the diagram without gestures.
         */}
        <div
          className="process-diagram-preview__controls"
          aria-label="Diagram view controls"
        >
          {/**
           * Provide directional navigation for large workflows so users can
           * move around the diagram without relying on drag gestures.
           */}
          <div
            className="process-diagram-preview__navigation-controls"
            aria-label="Diagram navigation controls"
          >
            <button
              type="button"
              className="process-diagram-preview__control"
              aria-label="Move diagram up"
              onClick={handleMoveUp}
            >
              ↑
            </button>

            <button
              type="button"
              className="process-diagram-preview__control"
              aria-label="Move diagram down"
              onClick={handleMoveDown}
            >
              ↓
            </button>

            <button
              type="button"
              className="process-diagram-preview__control"
              aria-label="Move diagram left"
              onClick={handleMoveLeft}
            >
              ←
            </button>

            <button
              type="button"
              className="process-diagram-preview__control"
              aria-label="Move diagram right"
              onClick={handleMoveRight}
            >
              →
            </button>
          </div>

          <button
            type="button"
            className="process-diagram-preview__control"
            aria-label="Zoom out"
            onClick={handleZoomOut}
          >
            −
          </button>

          <span
            className="process-diagram-preview__zoom-level"
            aria-live="polite"
          >
            {Math.round(zoomLevel * 100)}%
          </span>

          <button
            type="button"
            className="process-diagram-preview__control"
            aria-label="Zoom in"
            onClick={handleZoomIn}
          >
            +
          </button>

          {/**
           * Automatically resize and reposition the diagram so the complete
           * workflow can be viewed within the current viewport.
           */}
          <button
            type="button"
            className="process-diagram-preview__control process-diagram-preview__control--fit"
            aria-label="Fit diagram to screen"
            onClick={handleFitToScreen}
          >
            Fit
          </button>

          <button
            type="button"
            className="process-diagram-preview__control process-diagram-preview__control--reset"
            aria-label="Reset diagram view"
            onClick={handleResetView}
          >
            Reset
          </button>
        </div>
      </header>

      {/**
       * The viewport remains stationary while the inner diagram content is scaled
       * and, in a later step, translated during panning.
       */}
      <div
        ref={viewportRef}
        className="process-diagram-preview__viewport"
        data-testid="process-diagram-viewport"
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
      >
        <div
          ref={surfaceRef}
          className="process-diagram-preview__surface"
          data-testid="process-diagram-content"
          style={{
            "--process-diagram-column-count": columnCount,
            transform:
              `translate(${panOffset.x}px, ${panOffset.y}px) ` +
              `scale(${zoomLevel})`,
          }}
        >
        {/**
         * Render measured connector paths in an SVG overlay.
         *
         * The overlay is excluded from the accessibility tree because the
         * process relationship is already represented by the underlying model.
         */}
        <svg
          className="process-diagram-preview__connectors"
          aria-hidden="true"
        >

          {/**
           * Define one reusable arrowhead marker for every process connector.
           *
           * The marker inherits the connector stroke color through
           * `context-stroke`, keeping the arrowhead visually synchronized with
           * future connector state and validation styling.
           */}
          <defs>
            <marker
              id="process-diagram-arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path
                d="M 0 0 L 8 4 L 0 8 Z"
                fill="context-stroke"
              />
            </marker>
          </defs>

          {connectorPaths.map((connector) => (
            <g
              key={
                `${connector.sourceStepId}-${connector.targetStepId}`
              }
              className="process-diagram-preview__connector-group"
            >
              <path
                markerEnd="url(#process-diagram-arrowhead)"
                className="process-diagram-preview__connector"
                data-testid={
                  `process-connector-${connector.sourceStepId}-${connector.targetStepId}`
                }
                data-source-step-id={connector.sourceStepId}
                data-target-step-id={connector.targetStepId}
                d={connector.path}
              />

              {/**
               * Render branch text only when the connection contains a usable
               * label. Ordinary unlabeled transitions remain visually clean.
               */}
              {connector.label && (
                <text
                  className="process-diagram-preview__connector-label"
                  data-testid={
                    `process-connector-label-${connector.sourceStepId}-${connector.targetStepId}`
                  }
                  x={connector.labelX}
                  y={connector.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {connector.label}
                </text>
              )}
            </g>
          ))}
        </svg>

        {layout.lanes.map((lane) => {
          const laneNodes = layout.nodes.filter(
            (node) => node.lane === lane.lane
          );

          return (
            <section
              key={lane.actor}
              className="process-diagram-preview__lane"
              aria-labelledby={`process-lane-${lane.lane}`}
            >
              <header className="process-diagram-preview__lane-header">
                <h3 id={`process-lane-${lane.lane}`}>
                  {lane.actor}
                </h3>
              </header>

              <div className="process-diagram-preview__lane-content">
                {laneNodes.map((node) => {
                  const step = stepById.get(
                    node.stepId
                  );

                  if (!step) {
                    return null;
                  }

                  /**
                   * Look up the highest validation severity associated with this process step
                   * so the node can receive the correct visual warning state.
                   */
                  const validationSeverity =
                    validationSeverityByStepId.get(node.stepId);

                  return (
                    <article
                      key={node.stepId}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select ${step.name}`}
                      aria-pressed={selectedStepId === node.stepId}
                      onClick={() => {
                        onStepSelect?.(node.stepId);
                      }}
                      onKeyDown={(event) => {
                        /**
                         * Match native button keyboard behavior so users can select a process step
                         * with either Enter or Space.
                         */
                        if (
                          event.key === "Enter" ||
                          event.key === " "
                        ) {
                          event.preventDefault();
                          onStepSelect?.(node.stepId);
                        }
                      }}
                      ref={(element) => {
                        /**
                         * Keep the latest rendered node element available for
                         * connector measurement and remove stale references
                         * when a node leaves the process model.
                         */
                        if (element) {
                          nodeElementsRef.current.set(
                            node.stepId,
                            element
                          );
                        } else {
                          nodeElementsRef.current.delete(
                            node.stepId
                          );
                        }
                      }}
                      className={[
                        "process-diagram-preview__node",
                        selectedStepId === node.stepId
                          ? "process-diagram-preview__node--selected"
                          : "",
                        validationSeverity === "error"
                          ? "process-diagram-preview__node--validation-error"
                          : "",
                        validationSeverity === "warning"
                          ? "process-diagram-preview__node--validation-warning"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")
                      }
                      data-column={node.column}
                      data-row={node.row}
                      style={{
                        /**
                         * Convert zero-based layout coordinates into one-based
                         * CSS Grid positions.
                         */
                        gridColumn: node.column + 1,
                        gridRow: node.row + 1,
                      }}
                    >
                      <span className="process-diagram-preview__node-type">
                        {step.type}
                      </span>

                      <strong>
                        {step.name}
                      </strong>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
    </section>
  );
};

export default ProcessDiagramPreview;