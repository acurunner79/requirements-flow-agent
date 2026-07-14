import { useState } from "react";

// ========================================
// Actor Editor Component
// ========================================

/**
 * Displays the actors detected in the business process and allows the user to
 * add, rename, or remove actors during the review stage.
 *
 * The component owns temporary editing state for the actor currently being
 * modified and for the new-actor input. The authoritative actor collection
 * remains in the parent process model and is updated only through the supplied
 * callbacks.
 *
 * Keeping actor-management behavior in a dedicated component provides several
 * benefits:
 * - Prevents the process summary component from becoming overly large
 * - Centralizes actor-specific validation and interaction logic
 * - Allows the same editor to be reused in future process-review layouts
 * - Creates a clear foundation for actor-to-swimlane mapping during export
 *
 * @param {object} props - Component properties.
 * @param {string[]} props.actors
 * The current ordered collection of actors stored in the process model.
 * @param {(actorName: string) => void} props.onAddActor
 * Adds a validated actor to the parent process model.
 * @param {(currentActor: string, updatedActor: string) => void}
 * props.onUpdateActor
 * Replaces an existing actor with a validated updated value.
 * @param {(actorName: string) => void} props.onRemoveActor
 * Removes an actor from the parent process model.
 * @returns {JSX.Element} The actor review and editing interface.
 */
const ActorEditor = ({
  actors,
  onAddActor,
  onUpdateActor,
  onRemoveActor,
}) => {
  const [newActor, setNewActor] = useState("");
  const [editingActor, setEditingActor] = useState(null);
  const [draftActor, setDraftActor] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  /**
   * Determines whether an actor name already exists.
   *
   * Actor comparisons are case-insensitive so values such as "Manager" and
   * "manager" are treated as duplicates rather than separate roles.
   *
   * The optional excluded actor is ignored during rename validation, allowing
   * an actor to retain its current value without being flagged as a duplicate.
   *
   * @param {string} actorName
   * The actor name that should be checked.
   * @param {string|null} excludedActor
   * An existing actor that should be ignored during the comparison.
   * @returns {boolean} True when a matching actor already exists.
   */
  const actorExists = (actorName, excludedActor = null) => {
    const normalizedActorName = actorName.trim().toLowerCase();

    return actors.some((actor) => {
      if (actor === excludedActor) {
        return false;
      }

      return actor.trim().toLowerCase() === normalizedActorName;
    });
  };

  /**
   * Updates the new-actor input and clears stale validation feedback once the
   * user resumes typing.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   * The new-actor input change event.
   * @returns {void}
   */
  const handleNewActorChange = (event) => {
    setNewActor(event.target.value);

    if (validationMessage) {
      setValidationMessage("");
    }
  };

  /**
   * Validates and submits a new actor to the parent process model.
   *
   * Empty values and duplicate actor names are rejected because each actor
   * should represent a distinct process participant or future swimlane.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * The add-actor form submission event.
   * @returns {void}
   */
  const handleAddActor = (event) => {
    event.preventDefault();

    const normalizedActor = newActor.trim();

    if (!normalizedActor) {
      setValidationMessage("Enter an actor before adding it.");
      return;
    }

    if (actorExists(normalizedActor)) {
      setValidationMessage("That actor already exists in the process.");
      return;
    }

    onAddActor(normalizedActor);
    setNewActor("");
    setValidationMessage("");
  };

  /**
   * Opens the rename interface for a specific actor.
   *
   * The current actor value is copied into temporary draft state so canceling
   * the edit does not modify the process model.
   *
   * @param {string} actor
   * The actor that should enter editing mode.
   * @returns {void}
   */
  const handleStartEditing = (actor) => {
    setEditingActor(actor);
    setDraftActor(actor);
    setValidationMessage("");
  };

  /**
   * Cancels the current actor rename and clears temporary state.
   *
   * @returns {void}
   */
  const handleCancelEditing = () => {
    setEditingActor(null);
    setDraftActor("");
    setValidationMessage("");
  };

  /**
   * Updates the temporary actor draft and clears stale validation feedback.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event
   * The actor rename input change event.
   * @returns {void}
   */
  const handleDraftActorChange = (event) => {
    setDraftActor(event.target.value);

    if (validationMessage) {
      setValidationMessage("");
    }
  };

  /**
   * Validates and saves an actor rename.
   *
   * The updated actor name must contain usable text and must not duplicate
   * another actor already present in the process model.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * The actor rename form submission event.
   * @returns {void}
   */
  const handleSaveActor = (event) => {
    event.preventDefault();

    const normalizedActor = draftActor.trim();

    if (!normalizedActor) {
      setValidationMessage("Enter an actor name before saving.");
      return;
    }

    if (actorExists(normalizedActor, editingActor)) {
      setValidationMessage("That actor already exists in the process.");
      return;
    }

    onUpdateActor(editingActor, normalizedActor);
    setEditingActor(null);
    setDraftActor("");
    setValidationMessage("");
  };

  /**
   * Requests removal of an actor from the parent process model.
   *
   * The parent utility will later determine whether related process-step owners
   * also require updates. For now, this component remains focused on forwarding
   * the user's selected actor.
   *
   * @param {string} actor
   * The actor that should be removed.
   * @returns {void}
   */
  const handleRemoveActor = (actor) => {
    onRemoveActor(actor);

    if (editingActor === actor) {
      handleCancelEditing();
    }
  };

  return (
    <section
      className="actor-editor"
      aria-labelledby="process-actors-heading"
    >
      <div className="actor-editor__header">
        <h3
          id="process-actors-heading"
          className="process-model-summary__section-title"
        >
          Actors
        </h3>

        <span className="process-model-summary__count">
          {actors.length} {actors.length === 1 ? "actor" : "actors"}
        </span>
      </div>

      <ul className="actor-editor__list">
        {actors.map((actor) => (
          <li key={actor} className="actor-editor__item">
            {editingActor === actor ? (
              <form
                className="actor-editor__edit-form"
                onSubmit={handleSaveActor}
                noValidate
              >
                <input
                  type="text"
                  value={draftActor}
                  onChange={handleDraftActorChange}
                  aria-label={`Rename ${actor}`}
                  aria-invalid={
                    validationMessage && !draftActor.trim()
                      ? "true"
                      : "false"
                  }
                  autoFocus
                />

                <div className="actor-editor__item-actions">
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
                <span className="actor-editor__name">{actor}</span>

                <div className="actor-editor__item-actions">
                  <button
                    type="button"
                    onClick={() => handleStartEditing(actor)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemoveActor(actor)}
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <form
        className="actor-editor__add-form"
        onSubmit={handleAddActor}
        noValidate
      >
        <label htmlFor="new-actor">
          Add actor
        </label>

        <div className="actor-editor__add-controls">
          <input
            id="new-actor"
            type="text"
            value={newActor}
            onChange={handleNewActorChange}
            placeholder="Example: Finance"
            aria-invalid={
              validationMessage && !newActor.trim()
                ? "true"
                : "false"
            }
            aria-describedby={
              validationMessage
                ? "actor-editor-validation"
                : undefined
            }
          />

          <button type="submit">
            Add Actor
          </button>
        </div>
      </form>

      {validationMessage && (
        <p
          id="actor-editor-validation"
          className="actor-editor__validation"
          role="alert"
        >
          {validationMessage}
        </p>
      )}
    </section>
  );
};

export default ActorEditor;