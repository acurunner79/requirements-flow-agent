import { useState } from "react";
import ProcessConnectionEditor from "./ProcessConnectionEditor";

// ========================================
// Process Step Type Options
// ========================================

/**
 * Defines the process element types currently supported by the process-review
 * interface.
 *
 * These values must remain aligned with:
 * - Backend AI prompt instructions
 * - Backend response normalization
 * - Frontend process validation
 * - Visio shape mappings
 *
 * Keeping the values centralized prevents inconsistent type labels from being
 * introduced through the editing interface.
 */
const PROCESS_STEP_TYPES = [
  "start",
  "process",
  "decision",
  "end",
];

// ========================================
// Process Step Card Component
// ========================================

/**
 * Displays and edits one process step within the reviewed process model.
 *
 * The component supports two related editing workflows:
 *
 * 1. Step metadata editing
 *    - Step description
 *    - Step type
 *    - Step owner
 *
 * 2. Outgoing connection editing
 *    - Target process step
 *    - Optional connector label
 *
 * Temporary form values remain local to this component. The authoritative
 * process model stays in `App.jsx` and is changed only through callbacks
 * supplied by the parent component.
 *
 * This separation ensures that:
 * - Canceling a metadata edit does not alter the process model
 * - Invalid values are not saved
 * - Connection changes remain synchronized with parent state
 * - The card can be reused in future process-review layouts
 * - Process data transformations remain outside the presentation component
 *
 * @param {object} props - Component properties.
 * @param {object} props.step
 * Structured process-step data.
 * @param {string} props.step.id
 * Unique identifier used by process connections and exports.
 * @param {string} props.step.label
 * Human-readable action, event, or decision description.
 * @param {string} props.step.type
 * Process element type.
 * @param {string} props.step.owner
 * Actor, team, department, or system responsible for the step.
 * @param {Array<object>} props.step.connections
 * Rich outgoing connection objects containing target IDs and labels.
 * @param {Array<object>} props.availableSteps
 * Complete process-step collection used to populate connection targets.
 * @param {number} props.stepNumber
 * One-based display position for the current process step.
 * @param {Array<object>} props.validationIssues
 * Validation errors and warnings associated with this process step.
 * @param {(stepId: string, updates: object) => void} props.onUpdateStep
 * Applies approved metadata changes to the parent process model.
 * @param {(stepId: string, connections: Array<object>) => void}
 * props.onUpdateConnections
 * Applies the complete outgoing connection collection to the parent model.
 * @returns {JSX.Element} A reviewable and editable process-step card.
 */
const ProcessStepCard = ({
  step,
  availableSteps,
  stepNumber,
  validationIssues,
  onUpdateStep,
  onUpdateConnections,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(step.label);
  const [draftType, setDraftType] = useState(step.type);
  const [draftOwner, setDraftOwner] = useState(step.owner);
  const [validationMessage, setValidationMessage] = useState("");

  /**
   * Converts the numeric list position into a consistent two-character display
   * label.
   *
   * Examples:
   * 1 becomes "01"
   * 9 becomes "09"
   * 12 remains "12"
   */
  const formattedStepNumber = String(stepNumber).padStart(2, "0");

  /**
   * Provides the rich outgoing connections used by the connection editor.
   *
   * `connections` is now the authoritative process-path structure throughout the
   * frontend. A defensive empty-array fallback prevents rendering failures if an
   * invalid or incomplete step reaches the component.
   */
  const stepConnections = Array.isArray(step.connections)
    ? step.connections
    : [];

  /**
   * Indicates whether the current step has any validation problems that should
   * be highlighted directly in the editor.
   */
  const hasValidationIssues = validationIssues.length > 0;

  /**
   * Opens the metadata edit interface and synchronizes draft fields with the
   * latest values received from the parent process model.
   *
   * Resetting the fields here prevents canceled or stale edits from appearing
   * when the user reopens the form.
   *
   * @returns {void}
   */
  const handleStartEditing = () => {
    setDraftLabel(step.label);
    setDraftType(step.type);
    setDraftOwner(step.owner);
    setValidationMessage("");
    setIsEditing(true);
  };

  /**
   * Discards all unsaved metadata changes and restores the read-only step view.
   *
   * The parent process model remains unchanged because updates are submitted
   * only through `handleSaveChanges`.
   *
   * @returns {void}
   */
  const handleCancelEditing = () => {
    setDraftLabel(step.label);
    setDraftType(step.type);
    setDraftOwner(step.owner);
    setValidationMessage("");
    setIsEditing(false);
  };

  /**
   * Updates the temporary step-description value and clears stale validation
   * feedback when the user resumes editing.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   * Step-description input change event.
   * @returns {void}
   */
  const handleLabelChange = (event) => {
    setDraftLabel(event.target.value);

    if (validationMessage) {
      setValidationMessage("");
    }
  };

  /**
   * Updates the temporary step-owner value and clears stale validation feedback
   * when the user resumes editing.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   * Step-owner input change event.
   * @returns {void}
   */
  const handleOwnerChange = (event) => {
    setDraftOwner(event.target.value);

    if (validationMessage) {
      setValidationMessage("");
    }
  };

  /**
   * Validates and saves the current metadata draft.
   *
   * Description and owner values are trimmed before validation and storage so
   * accidental surrounding whitespace does not become part of the process
   * model.
   *
   * Both fields are required because every Visio process shape needs a clear
   * label and responsible actor or system.
   *
   * When a step is changed to the `end` type, its existing connections are
   * cleared because an end step must terminate the process.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * Step metadata form submission event.
   * @returns {void}
   */
  const handleSaveChanges = (event) => {
    event.preventDefault();

    const normalizedLabel = draftLabel.trim();
    const normalizedOwner = draftOwner.trim();

    if (!normalizedLabel && !normalizedOwner) {
      setValidationMessage(
        "Enter a step description and an owner before saving."
      );
      return;
    }

    if (!normalizedLabel) {
      setValidationMessage(
        "Enter a step description before saving."
      );
      return;
    }

    if (!normalizedOwner) {
      setValidationMessage(
        "Enter an owner before saving."
      );
      return;
    }

    onUpdateStep(step.id, {
      label: normalizedLabel,
      type: draftType,
      owner: normalizedOwner,
    });

    /**
     * End steps cannot have outgoing paths.
     *
     * Clear any existing connections immediately when the user changes this
     * step to the end type so the process model remains internally consistent.
     */
    if (
      draftType === "end" &&
      stepConnections.length > 0
    ) {
      onUpdateConnections(step.id, []);
    }

    setValidationMessage("");
    setIsEditing(false);
  };

  return (
    <li
      className={[
        "process-step-card",
        hasValidationIssues
          ? "process-step-card--validation-issues"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="process-step-card__number"
        aria-label={`Process step ${stepNumber}`}
      >
        {formattedStepNumber}
      </div>

      <div className="process-step-card__content">
        {isEditing ? (
          <form
            className="process-step-card__edit-form"
            onSubmit={handleSaveChanges}
            noValidate
          >
            <div className="process-step-card__field">
              <label htmlFor={`step-label-${step.id}`}>
                Step description
              </label>

              <input
                id={`step-label-${step.id}`}
                type="text"
                value={draftLabel}
                onChange={handleLabelChange}
                aria-invalid={
                  validationMessage && !draftLabel.trim()
                    ? "true"
                    : "false"
                }
                aria-describedby={
                  validationMessage
                    ? `step-validation-${step.id}`
                    : undefined
                }
              />
            </div>

            <div className="process-step-card__field-row">
              <div className="process-step-card__field">
                <label htmlFor={`step-type-${step.id}`}>
                  Step type
                </label>

                <select
                  id={`step-type-${step.id}`}
                  value={draftType}
                  onChange={(event) => {
                    setDraftType(event.target.value);
                    setValidationMessage("");
                  }}
                >
                  {PROCESS_STEP_TYPES.map((stepType) => (
                    <option key={stepType} value={stepType}>
                      {stepType}
                    </option>
                  ))}
                </select>
              </div>

              <div className="process-step-card__field">
                <label htmlFor={`step-owner-${step.id}`}>
                  Owner
                </label>

                <input
                  id={`step-owner-${step.id}`}
                  type="text"
                  value={draftOwner}
                  onChange={handleOwnerChange}
                  aria-invalid={
                    validationMessage && !draftOwner.trim()
                      ? "true"
                      : "false"
                  }
                  aria-describedby={
                    validationMessage
                      ? `step-validation-${step.id}`
                      : undefined
                  }
                />
              </div>
            </div>

            {validationMessage && (
              <p
                id={`step-validation-${step.id}`}
                className="process-step-card__validation"
                role="alert"
              >
                {validationMessage}
              </p>
            )}

            <div className="process-step-card__edit-actions">
              <button type="submit">
                Save Changes
              </button>

              <button
                type="button"
                onClick={handleCancelEditing}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="process-step-card__header">
              <strong className="process-step-card__label">
                {step.label}
              </strong>

              <div className="process-step-card__header-actions">
                <span className="process-step-card__type">
                  {step.type}
                </span>

                <button
                  type="button"
                  className="process-step-card__edit-button"
                  onClick={handleStartEditing}
                >
                  Edit
                </button>
              </div>
            </div>

            <dl className="process-step-card__details">
              <div className="process-step-card__detail">
                <dt>Step ID</dt>
                <dd>{step.id}</dd>
              </div>

              <div className="process-step-card__detail">
                <dt>Owner</dt>
                <dd>{step.owner}</dd>
              </div>

              <div className="process-step-card__detail">
                <dt>Connections</dt>
                <dd>{stepConnections.length}</dd>
              </div>
            </dl>

            {hasValidationIssues && (
              <section
                className="process-step-card__validation-issues"
                aria-label={`Validation issues for ${step.label}`}
              >
                <div className="process-step-card__validation-heading">
                  <strong>
                    Validation
                  </strong>

                  <span>
                    {validationIssues.length}
                  </span>
                </div>

                <ul className="process-step-card__validation-list">
                  {validationIssues.map((issue, index) => (
                    <li
                      key={`${issue.code}-${index}`}
                      className={[
                        "process-step-card__validation-item",
                        `process-step-card__validation-item--${issue.severity}`,
                      ].join(" ")}
                    >
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {step.type !== "end" && (
              <ProcessConnectionEditor
                stepId={step.id}
                connections={stepConnections}
                availableSteps={availableSteps}
                onUpdateConnections={onUpdateConnections}
              />
            )}
          </>
        )}
      </div>
    </li>
  );
};

export default ProcessStepCard;