import { useState } from "react";

// ========================================
// Process Name Editor Component
// ========================================

/**
 * Displays the detected process name and allows the user to revise it during
 * the review stage.
 *
 * The component owns only temporary draft and validation state. The confirmed
 * process name remains in the parent process model and is updated through the
 * supplied callback after validation succeeds.
 *
 * Keeping process-name editing in a dedicated component prevents the broader
 * process summary from becoming responsible for field-level editing behavior.
 * It also provides a reusable pattern for future editable process metadata.
 *
 * @param {object} props - Component properties.
 * @param {string} props.processName
 * The current process name stored in the authoritative process model.
 * @param {(processName: string) => void} props.onUpdateProcessName
 * Saves a validated process name to the parent process model.
 * @returns {JSX.Element} A read-only or editable process-name interface.
 */
const ProcessNameEditor = ({
  processName,
  onUpdateProcessName,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftProcessName, setDraftProcessName] = useState(processName);
  const [validationMessage, setValidationMessage] = useState("");

  /**
   * Opens the editing interface and synchronizes the draft value with the most
   * recent process name supplied by the parent component.
   *
   * @returns {void}
   */
  const handleStartEditing = () => {
    setDraftProcessName(processName);
    setValidationMessage("");
    setIsEditing(true);
  };

  /**
   * Discards unsaved changes and restores the current process-model value.
   *
   * @returns {void}
   */
  const handleCancelEditing = () => {
    setDraftProcessName(processName);
    setValidationMessage("");
    setIsEditing(false);
  };

  /**
   * Updates the temporary process-name value and removes stale validation
   * feedback once the user resumes editing.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   * The process-name input change event.
   * @returns {void}
   */
  const handleProcessNameChange = (event) => {
    setDraftProcessName(event.target.value);

    if (validationMessage) {
      setValidationMessage("");
    }
  };

  /**
   * Validates and saves the draft process name.
   *
   * Leading and trailing whitespace is removed before validation and storage so
   * the process model receives a clean value suitable for headings, exports,
   * filenames, and future Visio page titles.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * The process-name form submission event.
   * @returns {void}
   */
  const handleSaveProcessName = (event) => {
    event.preventDefault();

    const normalizedProcessName = draftProcessName.trim();

    if (!normalizedProcessName) {
      setValidationMessage(
        "Enter a process name before saving."
      );
      return;
    }

    onUpdateProcessName(normalizedProcessName);
    setValidationMessage("");
    setIsEditing(false);
  };

  return (
    <section className="process-name-editor">
      {isEditing ? (
        <form
          className="process-name-editor__form"
          onSubmit={handleSaveProcessName}
          noValidate
        >
          <div className="process-name-editor__field">
            <label htmlFor="process-name">
              Process name
            </label>

            <input
              id="process-name"
              type="text"
              value={draftProcessName}
              onChange={handleProcessNameChange}
              aria-invalid={
                validationMessage && !draftProcessName.trim()
                  ? "true"
                  : "false"
              }
              aria-describedby={
                validationMessage
                  ? "process-name-validation"
                  : undefined
              }
              autoFocus
            />
          </div>

          {validationMessage && (
            <p
              id="process-name-validation"
              className="process-name-editor__validation"
              role="alert"
            >
              {validationMessage}
            </p>
          )}

          <div className="process-name-editor__actions">
            <button type="submit">
              Save Name
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
        <div className="process-name-editor__display">
          <h2 className="process-model-summary__title">
            {processName}
          </h2>

          <button
            type="button"
            className="process-name-editor__edit-button"
            onClick={handleStartEditing}
          >
            Edit Name
          </button>
        </div>
      )}
    </section>
  );
};

export default ProcessNameEditor;