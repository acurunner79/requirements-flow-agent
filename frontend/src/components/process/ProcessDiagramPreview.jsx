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

  const [
    connectorPaths,
    setConnectorPaths,
  ] = useState([]);

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
      </header>

      <div
        ref={surfaceRef}
        className="process-diagram-preview__surface"
        style={{
          "--process-diagram-column-count": columnCount,
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
          {connectorPaths.map((connector) => (
            <g
              key={
                `${connector.sourceStepId}-${connector.targetStepId}`
              }
              className="process-diagram-preview__connector-group"
            >
              <path
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

                  return (
                    <article
                      key={node.stepId}
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
                      className="process-diagram-preview__node"
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
    </section>
  );
};

export default ProcessDiagramPreview;