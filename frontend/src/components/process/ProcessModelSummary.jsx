import {
  useEffect,
  useRef,
  useState,
} from "react";
import ActorEditor from "./ActorEditor";
import ProcessExportActions from "./ProcessExportActions";
import ProcessNameEditor from "./ProcessNameEditor";
import ProcessStepCard from "./ProcessStepCard";
import ProcessValidationSummary from "./ProcessValidationSummary";
import ProcessDiagramPreview from "./ProcessDiagramPreview";
import {
  VALIDATION_SEVERITIES,
  validateProcessModel,
} from "../../utils/processValidationUtils";

// ========================================
// Process Model Summary Component
// ========================================

/**
 * Displays the complete process-review workspace for the structured process
 * model returned by the requirements-analysis API.
 *
 * This component organizes:
 * - Process-name review and editing
 * - Actor management
 * - Process-model validation feedback
 * - Process-step review and editing
 * - Outgoing connection and branch-label editing
 * - JSON and Visio-ready workbook export controls
 *
 * Validation is recalculated from the current process model during every
 * render. This ensures that validation status and export readiness update
 * immediately whenever the user changes process metadata, step data, or
 * connection data.
 *
 * The authoritative process model remains in `App.jsx`. This component does not
 * modify process data or generate files directly. Instead, it forwards approved
 * changes and export requests through callback props supplied by the parent
 * component.
 *
 * @param {object} props - Component properties.
 * @param {object} props.processModel
 * The structured process model currently stored in application state.
 * @param {(processName: string) => void} props.onUpdateProcessName
 * Saves an approved process-name change to the parent process model.
 * @param {(actorName: string) => void} props.onAddActor
 * Adds a validated actor to the parent process model.
 * @param {(currentActor: string, updatedActor: string) => void}
 * props.onUpdateActor
 * Replaces an existing actor and updates related step ownership.
 * @param {(actorName: string) => void} props.onRemoveActor
 * Removes an actor and marks related process steps as unassigned.
 * @param {(stepId: string, updates: object) => void} props.onUpdateStep
 * Applies approved field updates to a specific process step.
 * @param {(stepId: string, connections: Array<object>) => void}
 * props.onUpdateConnections
 * Applies the complete outgoing connection collection to a process step.
 * @param {() => void} props.onExportJson
 * Generates and downloads the current process model as JSON.
 * @param {() => Promise<void>} props.onExportVisio
 * Generates and downloads the current process model as a Visio-ready workbook.
 * @param {boolean} props.isExportingVisio
 * Indicates whether workbook generation is currently running.
 * @returns {JSX.Element} The complete process-review summary.
 */
const ProcessModelSummary = ({
  processModel,
  onUpdateProcessName,
  onAddActor,
  onUpdateActor,
  onRemoveActor,
  onUpdateStep,
  onUpdateConnections,
  onExportJson,
  onExportVisio,
  isExportingVisio,
}) => {

  /**
   * Track the process step currently selected from the diagram so the matching
   * editor card can be highlighted in the review workspace.
   */
  const [selectedStepId, setSelectedStepId] = useState(null);

    /**
   * Scroll the matching editor card into view whenever diagram selection
   * changes.
   */
  useEffect(() => {
    if (!selectedStepId) {
      return;
    }

    const selectedCard =
      stepCardElementsRef.current.get(selectedStepId);

    selectedCard?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [selectedStepId]);

  /**
   * Store each rendered editor card by step ID so diagram selection can bring
   * the matching card into view.
   */
  const stepCardElementsRef = useRef(new Map());

  /**
   * Validate the latest process-model state before rendering the review panel.
   *
   * The validator returns every detected issue rather than stopping after the
   * first failure. This provides a complete review checklist and supplies the
   * export controls with accurate readiness information.
   */
  const validationIssues = validateProcessModel(processModel);

  /**
   * Count blocking errors separately from non-blocking warnings.
   *
   * Exports are blocked only when validation errors remain. Warnings stay
   * visible to the user but do not prevent export because they represent review
   * concerns rather than structurally invalid process data.
   */
  const errorCount = validationIssues.filter(
    (issue) => issue.severity === VALIDATION_SEVERITIES.ERROR
  ).length;

  const warningCount = validationIssues.filter(
    (issue) => issue.severity === VALIDATION_SEVERITIES.WARNING
  ).length;

  const canExport = errorCount === 0;

  return (
    <section className="process-model-summary">
      <ProcessNameEditor
        processName={processModel.processName}
        onUpdateProcessName={onUpdateProcessName}
      />

      <ActorEditor
        actors={processModel.actors}
        onAddActor={onAddActor}
        onUpdateActor={onUpdateActor}
        onRemoveActor={onRemoveActor}
      />

      <ProcessValidationSummary
        validationIssues={validationIssues}
      />

      {/**
       * Present the current process model as a visual workflow before the user
       * moves into detailed step-by-step editing.
       *
       * The preview recalculates from the same process model on every render,
       * so actor, ownership, and step changes remain synchronized with the
       * editable review workspace below.
       */}
      <ProcessDiagramPreview
        processModel={processModel}
        validationIssues={validationIssues}
        selectedStepId={selectedStepId}
        onStepSelect={setSelectedStepId}
      />

      <section
        className="process-model-summary__section"
        aria-labelledby="process-steps-heading"
      >
        <div className="process-model-summary__section-header">
          <h3
            id="process-steps-heading"
            className="process-model-summary__section-title"
          >
            Process Steps
          </h3>

          <span className="process-model-summary__count">
            {processModel.steps.length}{" "}
            {processModel.steps.length === 1 ? "step" : "steps"}
          </span>
        </div>

        <ol className="process-model-summary__steps">
          {processModel.steps.map((step, index) => {
            /**
             * Associate validation problems with the process step they affect.
             *
             * Process-level issues do not contain a step ID and remain visible only in
             * the main validation summary.
             */
            const stepValidationIssues = validationIssues.filter(
              (issue) => issue.stepId === step.id
            );

            return (
              <ProcessStepCard
                key={step.id}
                step={step}
                availableSteps={processModel.steps}
                stepNumber={index + 1}
                validationIssues={stepValidationIssues}
                isSelected={selectedStepId === step.id}
                cardRef={(element) => {
                  /**
                   * Keep the latest editor element available for selection
                   * scrolling and remove stale entries after unmounting.
                   */
                  if (element) {
                    stepCardElementsRef.current.set(
                      step.id,
                      element
                    );
                  } else {
                    stepCardElementsRef.current.delete(
                      step.id
                    );
                  }
                }}
                onUpdateStep={onUpdateStep}
                onUpdateConnections={onUpdateConnections}
              />
            );
          })}
        </ol>
      </section>

      <ProcessExportActions
        canExport={canExport}
        errorCount={errorCount}
        warningCount={warningCount}
        isExportingVisio={isExportingVisio}
        onExportJson={onExportJson}
        onExportVisio={onExportVisio}
      />
    </section>
  );
};

export default ProcessModelSummary;