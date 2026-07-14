import { useState } from "react";
import AppHeader from "./components/layout/AppHeader";
import WorkflowStages from "./components/layout/WorkflowStages";
import ProcessModelSummary from "./components/process/ProcessModelSummary";
import RequirementsForm from "./components/requirements/RequirementsForm";
import { analyzeRequirements } from "./services/requirementsAnalysisService";
import { exportProcessModelAsJson } from "./utils/fileExportUtils";
import { exportProcessModelForVisio } from "./utils/visioExportUtils";
import {
  addProcessActor,
  removeProcessActor,
  updateProcessActor,
  updateProcessName,
  updateProcessStep,
  updateProcessStepConnections,
} from "./utils/processModelUtils";

// ========================================
// Application Component
// ========================================

/**
 * Coordinates the complete requirements-analysis and process-review workspace.
 *
 * This component owns the authoritative application state and connects the
 * reusable interface components to the backend analysis service.
 *
 * Its responsibilities include:
 * - Tracking the user's business-requirements input
 * - Managing analysis, error, and process-model state
 * - Determining which workflow stage should appear active
 * - Resetting the workspace when the user starts a new flow
 * - Applying approved edits to the process name
 * - Adding, renaming, and removing process actors
 * - Applying approved edits to individual process steps
 * - Delegating API communication to the service layer
 * - Passing process data and callbacks into presentation-focused components
 *
 * Layout, forms, metadata editors, and process-step rendering remain in
 * dedicated components so this file stays focused on application-level
 * orchestration.
 */
const App = () => {
  const [requirements, setRequirements] = useState("");
  const [processModel, setProcessModel] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExportingVisio, setIsExportingVisio] = useState(false);

  /**
   * Determines the active workflow stage from the current application state.
   *
   * Stage 1 represents requirements entry.
   * Stage 2 represents an active analysis request.
   * Stage 3 represents a returned process model that is ready for review.
   *
   * Stage 4 will be introduced when export functionality is added.
   */
  const currentStage = isAnalyzing ? 2 : processModel ? 3 : 1;

  /**
   * Indicates whether the workspace contains user-entered, generated, or error
   * content that can be cleared through the header's "New Flow" action.
   *
   * Whitespace-only requirements do not count as meaningful workspace content.
   */
  const hasWorkspaceContent =
    requirements.trim().length > 0 ||
    processModel !== null ||
    errorMessage.length > 0;

  /**
   * Clears all current workspace state and returns the application to its
   * initial requirements-entry stage.
   *
   * Resetting every related state value together prevents stale process data,
   * validation messages, or loading indicators from carrying into the next
   * workflow session.
   *
   * @returns {void}
   */
  const handleResetWorkspace = () => {
    setRequirements("");
    setProcessModel(null);
    setErrorMessage("");
    setIsAnalyzing(false);
    setIsExportingVisio(false);
  };

  /**
   * Applies an approved process-name change to the current process model.
   *
   * The reusable utility performs the immutable transformation while this
   * handler remains responsible only for applying the returned model to React
   * state.
   *
   * @param {string} processName
   * The validated and normalized process name supplied by the editor.
   *
   * @returns {void}
   */
  const handleUpdateProcessName = (processName) => {
    setProcessModel((currentProcessModel) => {
      // Ignore unexpected update attempts before a process model exists.
      if (!currentProcessModel) {
        return currentProcessModel;
      }

      return updateProcessName(
        currentProcessModel,
        processName
      );
    });
  };

  /**
   * Adds a validated actor to the current process model.
   *
   * Actor order is preserved because it will later determine the default
   * swimlane order in generated process diagrams.
   *
   * @param {string} actorName
   * The validated actor, role, team, or system to add.
   *
   * @returns {void}
   */
  const handleAddProcessActor = (actorName) => {
    setProcessModel((currentProcessModel) => {
      // Ignore unexpected actor updates before analysis has produced a model.
      if (!currentProcessModel) {
        return currentProcessModel;
      }

      return addProcessActor(
        currentProcessModel,
        actorName
      );
    });
  };

  /**
   * Renames an existing actor and synchronizes related process-step ownership.
   *
   * The actor utility updates both the actor collection and every process step
   * currently owned by the renamed actor. This keeps the process model
   * internally consistent before validation and export.
   *
   * @param {string} currentActorName
   * The actor value currently stored in the process model.
   *
   * @param {string} updatedActorName
   * The validated actor name that should replace the current value.
   *
   * @returns {void}
   */
  const handleUpdateProcessActor = (
    currentActorName,
    updatedActorName
  ) => {
    setProcessModel((currentProcessModel) => {
      // Ignore unexpected actor updates before analysis has produced a model.
      if (!currentProcessModel) {
        return currentProcessModel;
      }

      return updateProcessActor(
        currentProcessModel,
        currentActorName,
        updatedActorName
      );
    });
  };

  /**
   * Removes an actor from the process model.
   *
   * Steps currently owned by the removed actor remain in the process, but their
   * owner is changed to "Unassigned". Preserving the steps avoids accidental
   * process-data loss and makes reassignment requirements visible during review.
   *
   * @param {string} actorName
   * The actor that should be removed from the process model.
   *
   * @returns {void}
   */
  const handleRemoveProcessActor = (actorName) => {
    setProcessModel((currentProcessModel) => {
      // Ignore unexpected actor updates before analysis has produced a model.
      if (!currentProcessModel) {
        return currentProcessModel;
      }

      return removeProcessActor(
        currentProcessModel,
        actorName
      );
    });
  };

  /**
   * Applies approved field changes to a single process step.
   *
   * The reusable utility performs the immutable data transformation. This
   * handler is responsible only for updating React state with the resulting
   * process model.
   *
   * @param {string} stepId
   * The unique identifier of the process step being edited.
   *
   * @param {object} updates
   * A partial step object containing the approved field changes.
   *
   * @returns {void}
   */
  const handleUpdateProcessStep = (stepId, updates) => {
    setProcessModel((currentProcessModel) => {
      // Protect against an unexpected edit attempt before a process model has
      // been generated.
      if (!currentProcessModel) {
        return currentProcessModel;
      }

      return updateProcessStep(
        currentProcessModel,
        stepId,
        updates
      );
    });
  };

/**
 * Replaces the outgoing connection collection for one process step.
 *
 * The reusable utility performs the immutable state transformation and
 * normalizes the authoritative rich `connections` collection before storing
 * it in the process model.
 *
 * Each connection stores:
 * - The target process-step identifier
 * - An optional connector label
 *
 * Using the functional state-update form ensures the transformation always
 * receives the latest process model.
 *
 * @param {string} stepId
 * Identifier of the process step whose outgoing connections should change.
 * @param {Array<object>} connections
 * Complete replacement collection of outgoing connection objects.
 *
 * @returns {void}
 */
  const handleUpdateProcessStepConnections = (
    stepId,
    connections
  ) => {
    setProcessModel((currentProcessModel) => {
      // Ignore unexpected connection updates before a process model exists.
      if (!currentProcessModel) {
        return currentProcessModel;
      }

      return updateProcessStepConnections(
        currentProcessModel,
        stepId,
        connections
      );
    });
  };

    /**
   * Exports the current reviewed process model as a formatted JSON file.
   *
   * File creation and browser-download behavior remain in the reusable export
   * utility. This handler only verifies that a process model exists before
   * delegating the export operation.
   *
   * Export availability is already controlled by the validation state in
   * `ProcessModelSummary`, but this additional guard protects against an
   * unexpected export request before analysis has produced a model.
   *
   * @returns {void}
   */
  const handleExportProcessModelAsJson = () => {
    if (!processModel) {
      return;
    }

    exportProcessModelAsJson(processModel);
  };

  /**
 * Generates and downloads a Visio-ready Excel workbook from the current
 * reviewed process model.
 *
 * Workbook construction remains inside the reusable Visio export utility so
 * this application component stays focused on state management and workflow
 * orchestration.
 *
 * The loading state prevents duplicate export requests while ExcelJS is
 * generating and serializing the workbook in the browser.
 *
 * @returns {Promise<void>}
 */
  const handleExportProcessModelForVisio = async () => {
    // Protect against an unexpected export request before analysis has generated
    // a process model.
    if (!processModel || isExportingVisio) {
      return;
    }

    setErrorMessage("");
    setIsExportingVisio(true);

    try {
      await exportProcessModelForVisio(processModel);
    } catch (error) {
      // Surface workbook-generation failures through the existing workspace error
      // area so users receive visible feedback instead of a silent failure.
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while generating the Visio workbook."
      );
    } finally {
      // Restore the export controls after generation succeeds or fails.
      setIsExportingVisio(false);
    }
  };

  /**
   * Submits the current business-requirements text for analysis.
   *
   * The function validates input, clears stale output, manages the loading
   * state, calls the reusable API service, and stores either the returned
   * process model or a user-facing error message.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * The form submission event generated by the requirements form.
   *
   * @returns {Promise<void>}
   */
  const handleAnalyzeRequirements = async (event) => {
    event.preventDefault();

    // Clear the previous result and error so the workspace reflects only the
    // current analysis attempt.
    setErrorMessage("");
    setProcessModel(null);

    // Prevent an unnecessary backend request when the input contains no usable
    // business-requirements text.
    if (!requirements.trim()) {
      setErrorMessage(
        "Enter business requirements before analyzing."
      );
      return;
    }

    setIsAnalyzing(true);

    try {
      // Delegate request construction, response parsing, and backend error
      // handling to the reusable requirements-analysis service.
      const responseData = await analyzeRequirements(requirements);

      setProcessModel(responseData);
    } catch (error) {
      // Use the specific error message when available while retaining a safe
      // fallback for unexpected thrown values.
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while analyzing the requirements."
      );
    } finally {
      // Always restore the interface after the request completes, regardless
      // of whether the backend returned a successful response.
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="app-shell">
      <AppHeader
        onResetWorkspace={handleResetWorkspace}
        hasWorkspaceContent={hasWorkspaceContent}
      />

      <WorkflowStages currentStage={currentStage} />

      <main className="app-main">
        <section className="workspace">
          <div className="workspace__intro">
            <p className="workspace__eyebrow">PROCESS INPUT</p>

            <h2 className="workspace__title">
              Define the business process
            </h2>

            <p className="workspace__description">
              Paste the source requirements below. The agent will identify the
              actors, process steps, ownership, and workflow structure.
            </p>
          </div>

          <div className="workspace__content">
            <section className="workspace-panel workspace-panel--input">
              <RequirementsForm
                requirements={requirements}
                onRequirementsChange={setRequirements}
                onSubmit={handleAnalyzeRequirements}
                isAnalyzing={isAnalyzing}
              />

              {errorMessage && (
                <p className="workspace__error" role="alert">
                  {errorMessage}
                </p>
              )}
            </section>

            <section className="workspace-panel workspace-panel--output">
              {processModel ? (
                <ProcessModelSummary
                  processModel={processModel}
                  onUpdateProcessName={handleUpdateProcessName}
                  onAddActor={handleAddProcessActor}
                  onUpdateActor={handleUpdateProcessActor}
                  onRemoveActor={handleRemoveProcessActor}
                  onUpdateStep={handleUpdateProcessStep}
                  onUpdateConnections={handleUpdateProcessStepConnections}
                  onExportJson={handleExportProcessModelAsJson}
                  onExportVisio={handleExportProcessModelForVisio}
                  isExportingVisio={isExportingVisio}
                />
              ) : (
                <div className="workspace__empty-state">
                  <span className="workspace__empty-number">
                    02
                  </span>

                  <h3>Process model awaiting analysis</h3>

                  <p>
                    Submit business requirements to generate the first
                    structured process model.
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;