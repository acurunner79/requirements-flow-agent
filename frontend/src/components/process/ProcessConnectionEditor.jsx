import { useState } from "react";

// ========================================
// Process Connection Editor Component
// ========================================

/**
 * Displays and edits the outgoing connections for a single process step.
 *
 * Each connection contains:
 * - `targetStepId`: The identifier of the next process step
 * - `label`: Optional connector text such as Yes, No, Approved, or Rejected
 *
 * The component owns temporary draft state while a connection is being edited.
 * The authoritative process model remains in `App.jsx` and is updated only
 * through the callback supplied by the parent component.
 *
 * Keeping connection editing isolated provides a reusable foundation for:
 * - Decision-branch labels
 * - Multiple outgoing paths
 * - Visio connector-label export
 * - Future diagram preview controls
 * - Connection-level validation
 *
 * @param {object} props - Component properties.
 * @param {string} props.stepId
 * Identifier of the process step that owns the outgoing connections.
 * @param {Array<object>} props.connections
 * Current outgoing connection objects.
 * @param {Array<object>} props.availableSteps
 * Complete process-step collection used to populate target-step options.
 * @param {(stepId: string, connections: Array<object>) => void}
 * props.onUpdateConnections
 * Saves the complete updated connection collection to the parent process model.
 * @returns {JSX.Element} The connection review and editing interface.
 */
const ProcessConnectionEditor = ({
  stepId,
  connections,
  availableSteps,
  onUpdateConnections,
}) => {
  const [editingConnectionIndex, setEditingConnectionIndex] =
    useState(null);
  const [draftTargetStepId, setDraftTargetStepId] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  /**
   * Excludes the current step from valid connection targets.
   *
   * Self-referencing connections are not supported by the current editor
   * because they usually indicate accidental circular logic. More advanced loop
   * handling can be introduced later through explicit validation rules.
   */
  const targetStepOptions = availableSteps.filter(
    (step) => step.id !== stepId
  );

  /**
   * Opens the editor for one existing connection and copies its values into
   * temporary draft state.
   *
   * @param {number} connectionIndex
   * Zero-based position of the connection being edited.
   * @returns {void}
   */
  const handleStartEditing = (connectionIndex) => {
    const connection = connections[connectionIndex];

    setEditingConnectionIndex(connectionIndex);
    setDraftTargetStepId(connection.targetStepId);
    setDraftLabel(connection.label || "");
    setValidationMessage("");
  };

  /**
   * Discards all temporary edits and restores the read-only connection view.
   *
   * @returns {void}
   */
  const handleCancelEditing = () => {
    setEditingConnectionIndex(null);
    setDraftTargetStepId("");
    setDraftLabel("");
    setValidationMessage("");
  };

  /**
   * Validates and saves changes to one connection.
   *
   * The target step is required because a connector without a destination
   * cannot be represented in the process model or exported diagram.
   *
   * Connector labels remain optional because ordinary sequential paths may not
   * require text. Decision paths should later be validated separately to ensure
   * their branches are meaningfully labeled.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * Connection edit form submission event.
   * @returns {void}
   */
  const handleSaveConnection = (event) => {
    event.preventDefault();

    if (!draftTargetStepId) {
      setValidationMessage(
        "Select a target process step before saving."
      );
      return;
    }

    const updatedConnections = connections.map(
      (connection, connectionIndex) => {
        if (connectionIndex !== editingConnectionIndex) {
          return connection;
        }

        return {
          targetStepId: draftTargetStepId,
          label: draftLabel.trim(),
        };
      }
    );

    onUpdateConnections(stepId, updatedConnections);
    handleCancelEditing();
  };

  /**
   * Removes one outgoing connection from the current process step.
   *
   * A new array is created so the parent process model can be updated
   * immutably.
   *
   * @param {number} connectionIndex
   * Zero-based position of the connection to remove.
   * @returns {void}
   */
  const handleRemoveConnection = (connectionIndex) => {
    const updatedConnections = connections.filter(
      (_, index) => index !== connectionIndex
    );

    onUpdateConnections(stepId, updatedConnections);

    if (editingConnectionIndex === connectionIndex) {
      handleCancelEditing();
    }
  };

  /**
   * Adds a new connection using the first available target step.
   *
   * The new item is immediately placed into editing mode so the user can choose
   * the correct target and add an optional branch label.
   *
   * @returns {void}
   */
  const handleAddConnection = () => {
    if (targetStepOptions.length === 0) {
      setValidationMessage(
        "No additional process steps are available as connection targets."
      );
      return;
    }

    const newConnection = {
      targetStepId: targetStepOptions[0].id,
      label: "",
    };

    const updatedConnections = [
      ...connections,
      newConnection,
    ];

    onUpdateConnections(stepId, updatedConnections);

    setEditingConnectionIndex(updatedConnections.length - 1);
    setDraftTargetStepId(newConnection.targetStepId);
    setDraftLabel("");
    setValidationMessage("");
  };

  return (
    <section className="process-connection-editor">
      <div className="process-connection-editor__header">
        <h4 className="process-connection-editor__title">
          Outgoing Connections
        </h4>

        <button
          type="button"
          className="process-connection-editor__add-button"
          onClick={handleAddConnection}
          disabled={targetStepOptions.length === 0}
        >
          Add Connection
        </button>
      </div>

      {connections.length === 0 ? (
        <p className="process-connection-editor__empty">
          This step does not currently connect to another process step.
        </p>
      ) : (
        <ul className="process-connection-editor__list">
          {connections.map((connection, index) => {
            const targetStep = availableSteps.find(
              (step) => step.id === connection.targetStepId
            );

            return (
              <li
                key={`${connection.targetStepId}-${index}`}
                className="process-connection-editor__item"
              >
                {editingConnectionIndex === index ? (
                  <form
                    className="process-connection-editor__form"
                    onSubmit={handleSaveConnection}
                    noValidate
                  >
                    <div className="process-connection-editor__fields">
                      <div className="process-connection-editor__field">
                        <label
                          htmlFor={`connection-target-${stepId}-${index}`}
                        >
                          Target step
                        </label>

                        <select
                          id={`connection-target-${stepId}-${index}`}
                          value={draftTargetStepId}
                          onChange={(event) => {
                            setDraftTargetStepId(event.target.value);
                            setValidationMessage("");
                          }}
                        >
                          {targetStepOptions.map((step) => (
                            <option key={step.id} value={step.id}>
                              {step.id} — {step.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="process-connection-editor__field">
                        <label
                          htmlFor={`connection-label-${stepId}-${index}`}
                        >
                          Connector label
                        </label>

                        <input
                          id={`connection-label-${stepId}-${index}`}
                          type="text"
                          value={draftLabel}
                          onChange={(event) => {
                            setDraftLabel(event.target.value);
                            setValidationMessage("");
                          }}
                          placeholder="Example: Yes"
                        />
                      </div>
                    </div>

                    {validationMessage && (
                      <p
                        className="process-connection-editor__validation"
                        role="alert"
                      >
                        {validationMessage}
                      </p>
                    )}

                    <div className="process-connection-editor__form-actions">
                      <button type="submit">
                        Save
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
                    <div className="process-connection-editor__summary">
                      <span className="process-connection-editor__target">
                        {connection.targetStepId}
                      </span>

                      <span className="process-connection-editor__description">
                        {targetStep?.label || "Unknown target step"}
                      </span>

                      <span className="process-connection-editor__label">
                        {connection.label || "No connector label"}
                      </span>
                    </div>

                    <div className="process-connection-editor__actions">
                      <button
                        type="button"
                        onClick={() => handleStartEditing(index)}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveConnection(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {validationMessage && editingConnectionIndex === null && (
        <p
          className="process-connection-editor__validation"
          role="alert"
        >
          {validationMessage}
        </p>
      )}
    </section>
  );
};

export default ProcessConnectionEditor;