// ========================================
// Workflow Stage Configuration
// ========================================

/**
 * Defines the major stages in the requirements-to-process workflow.
 *
 * Keeping this data outside the component markup makes the stage navigation
 * easier to maintain, reorder, and expand. A future version can also attach
 * route paths, completion states, validation results, or click behavior without
 * requiring the rendered structure to be rewritten.
 */
const WORKFLOW_STAGES = [
  {
    number: "01",
    label: "Input",
    description: "Provide business requirements",
  },
  {
    number: "02",
    label: "Analyze",
    description: "Extract actors, steps, and decisions",
  },
  {
    number: "03",
    label: "Review",
    description: "Validate and refine the process model",
  },
  {
    number: "04",
    label: "Export",
    description: "Generate Visio-ready output",
  },
];

// ========================================
// Workflow Stages Component
// ========================================

/**
 * Displays the major stages of the application workflow.
 *
 * The current stage is supplied by the parent component so this layout
 * component does not need to know how application state is managed. This keeps
 * it reusable for future page layouts, multi-step workspaces, or route-based
 * navigation.
 *
 * @param {object} props - Component properties.
 * @param {number} props.currentStage
 * One-based index identifying the active workflow stage.
 * @returns {JSX.Element} The workflow-stage navigation.
 */
const WorkflowStages = ({ currentStage }) => {
  return (
    <nav
      className="workflow-stages"
      aria-label="Requirements workflow progress"
    >
      <ol className="workflow-stages__list">
        {WORKFLOW_STAGES.map((stage, index) => {
          const stagePosition = index + 1;
          const isActive = stagePosition === currentStage;
          const isComplete = stagePosition < currentStage;

          return (
            <li
              key={stage.number}
              className={[
                "workflow-stages__item",
                isActive ? "workflow-stages__item--active" : "",
                isComplete ? "workflow-stages__item--complete" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-current={isActive ? "step" : undefined}
            >
              <span className="workflow-stages__number">
                {stage.number}
              </span>

              <div className="workflow-stages__content">
                <span className="workflow-stages__label">
                  {stage.label}
                </span>

                <span className="workflow-stages__description">
                  {stage.description}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default WorkflowStages;