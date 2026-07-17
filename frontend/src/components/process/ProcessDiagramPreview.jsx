import { createProcessDiagramLayout } from "../../utils/processDiagramLayoutUtils";

// ========================================
// Process Diagram Preview Component
// ========================================

/**
 * Renders a visual preview of the current process model.
 *
 * This first version focuses on the two foundational diagram elements:
 * actor swimlane headings and process step nodes. Connector rendering and
 * interaction controls will be added in later Phase 3 milestones.
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
  const layout = createProcessDiagramLayout(
    processModel
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
        className="process-diagram-preview__surface"
        style={{
          "--process-diagram-column-count": columnCount,
        }}
      >
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