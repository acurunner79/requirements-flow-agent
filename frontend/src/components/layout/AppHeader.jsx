// ========================================
// Application Header Component
// ========================================

/**
 * Renders the primary application header displayed above the requirements
 * analysis workspace.
 *
 * The header introduces the product, communicates the workspace purpose, shows
 * the current application status, and exposes a reset action for starting a new
 * process-flow session.
 *
 * The reset behavior is supplied by the parent component because `App.jsx`
 * owns the requirements text, analysis result, and error state that must be
 * cleared together.
 *
 * @param {object} props - Component properties.
 * @param {() => void} props.onResetWorkspace
 * Clears the current requirements-analysis workspace.
 * @param {boolean} props.hasWorkspaceContent
 * Indicates whether the workspace contains requirements text, a generated
 * process model, or another state that can be reset.
 * @returns {JSX.Element} The application header.
 */
const AppHeader = ({
  onResetWorkspace,
  hasWorkspaceContent,
}) => {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <p className="app-header__eyebrow">AI PROCESS DESIGN</p>

        <div>
          <h1 className="app-header__title">Requirements Flow Agent</h1>

          <p className="app-header__description">
            Transform business requirements into structured, reviewable process
            flows.
          </p>
        </div>
      </div>

      <div className="app-header__actions">
        <div className="app-header__status" aria-label="Application status">
          <span
            className="app-header__status-indicator"
            aria-hidden="true"
          />

          <span>Workspace ready</span>
        </div>

        <button
          type="button"
          className="app-header__reset-button"
          onClick={onResetWorkspace}
          disabled={!hasWorkspaceContent}
        >
          New Flow
        </button>
      </div>
    </header>
  );
};

export default AppHeader;