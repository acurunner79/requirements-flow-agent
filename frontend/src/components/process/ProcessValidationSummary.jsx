import { useState } from "react";

import { VALIDATION_SEVERITIES } from "../../utils/processValidationUtils";

// ========================================
// Process Validation Summary Configuration
// ========================================

/**
 * Defines how many issues from each severity group are shown while the
 * validation summary is collapsed.
 *
 * Keeping the collapsed preview intentionally small prevents large AI-generated
 * workflows from pushing the process-step review area far down the page.
 */
const COLLAPSED_ISSUE_LIMIT = 3;

// ========================================
// Validation Issue List Component
// ========================================

/**
 * Displays one severity group inside the validation summary.
 *
 * The group shows a small preview while validation details are collapsed and
 * the complete issue collection when the user expands the panel.
 *
 * @param {object} props - Component properties.
 * @param {string} props.headingId
 * Unique accessible identifier for the group heading.
 * @param {string} props.heading
 * Visible severity heading such as "Errors" or "Warnings".
 * @param {Array<object>} props.issues
 * Validation issues belonging to the severity group.
 * @param {"error"|"warning"} props.variant
 * Visual treatment applied to each validation item.
 * @param {boolean} props.isExpanded
 * Whether the complete issue collection should be rendered.
 *
 * @returns {JSX.Element|null}
 * Validation issue group, or null when the group contains no issues.
 */
const ValidationIssueGroup = ({
  headingId,
  heading,
  issues,
  variant,
  isExpanded,
}) => {
  if (issues.length === 0) {
    return null;
  }

  /**
   * While collapsed, show only a compact preview.
   *
   * Expanded mode renders the complete collection inside a scrollable details
   * region controlled by the parent component.
   */
  const visibleIssues = isExpanded
    ? issues
    : issues.slice(0, COLLAPSED_ISSUE_LIMIT);

  const hiddenIssueCount =
    issues.length - visibleIssues.length;

  return (
    <section
      className="process-validation-summary__group"
      aria-labelledby={headingId}
    >
      <div className="process-validation-summary__group-header">
        <h4 id={headingId}>
          {heading}
        </h4>

        <span>
          {issues.length}
        </span>
      </div>

      <ul className="process-validation-summary__list">
        {visibleIssues.map((issue, index) => (
          <li
            key={`${issue.code}-${issue.stepId || "process"}-${index}`}
            className={[
              "process-validation-summary__item",
              `process-validation-summary__item--${variant}`,
            ].join(" ")}
          >
            <span className="process-validation-summary__marker">
              !
            </span>

            <div>
              <p>{issue.message}</p>

              {issue.stepId && (
                <span className="process-validation-summary__step-id">
                  Step ID: {issue.stepId}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!isExpanded && hiddenIssueCount > 0 && (
        <p className="process-validation-summary__hidden-count">
          {hiddenIssueCount} additional{" "}
          {hiddenIssueCount === 1 ? "issue" : "issues"} hidden
        </p>
      )}
    </section>
  );
};

// ========================================
// Process Validation Summary Component
// ========================================

/**
 * Displays process-model validation results during the review stage.
 *
 * The summary remains compact by default so large issue collections do not
 * dominate the process-review column. Users can expand the panel to inspect all
 * errors and warnings inside a bounded scrollable region.
 *
 * The component receives precomputed validation issues and remains focused on
 * presentation. Validation rules stay in the shared utility module so the same
 * logic can later be reused by export controls, backend validation, automated
 * tests, and saved-project workflows.
 *
 * @param {object} props - Component properties.
 * @param {Array<object>} props.validationIssues
 * Collection of normalized validation issues returned by
 * `validateProcessModel`.
 * @param {string} props.validationIssues[].code
 * Stable machine-readable validation identifier.
 * @param {string} props.validationIssues[].severity
 * Issue severity, such as "error" or "warning".
 * @param {string} props.validationIssues[].message
 * Human-readable explanation of the validation issue.
 * @param {string|null} props.validationIssues[].stepId
 * Optional identifier of the affected process step.
 *
 * @returns {JSX.Element}
 * Compact validation status with expandable issue details.
 */
const ProcessValidationSummary = ({ validationIssues }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  /**
   * Separate blocking errors from non-blocking warnings so each group can use
   * its own count, heading, and visual treatment.
   */
  const errorIssues = validationIssues.filter(
    (issue) =>
      issue.severity === VALIDATION_SEVERITIES.ERROR
  );

  const warningIssues = validationIssues.filter(
    (issue) =>
      issue.severity === VALIDATION_SEVERITIES.WARNING
  );

  const hasValidationIssues =
    validationIssues.length > 0;

  /**
   * The collapsed preview shows up to three errors and three warnings.
   *
   * The expand control is only necessary when at least one severity group
   * contains more issues than the preview limit.
   */
  const hasHiddenIssues =
    errorIssues.length > COLLAPSED_ISSUE_LIMIT ||
    warningIssues.length > COLLAPSED_ISSUE_LIMIT;

  /**
   * Toggles the detailed validation region without altering any process data.
   */
  const handleToggleExpanded = () => {
    setIsExpanded((currentValue) => !currentValue);
  };

  return (
    <section
      className={[
        "process-validation-summary",
        hasValidationIssues
          ? "process-validation-summary--issues"
          : "process-validation-summary--ready",
      ].join(" ")}
      aria-labelledby="process-validation-heading"
    >
      <div className="process-validation-summary__header">
        <div>
          <p className="process-validation-summary__eyebrow">
            Validation
          </p>

          <h3
            id="process-validation-heading"
            className="process-validation-summary__title"
          >
            {hasValidationIssues
              ? "Process review required"
              : "Process model ready"}
          </h3>

          {hasValidationIssues && (
            <p className="process-validation-summary__overview">
              {errorIssues.length}{" "}
              {errorIssues.length === 1 ? "error" : "errors"}
              {" · "}
              {warningIssues.length}{" "}
              {warningIssues.length === 1
                ? "warning"
                : "warnings"}
            </p>
          )}
        </div>

        <div
          className="process-validation-summary__status"
          aria-label={
            hasValidationIssues
              ? `${validationIssues.length} validation issues`
              : "No validation issues"
          }
        >
          {hasValidationIssues
            ? validationIssues.length
            : "✓"}
        </div>
      </div>

      {!hasValidationIssues && (
        <p className="process-validation-summary__ready-message">
          No current validation rules detected a problem with the process model.
        </p>
      )}

      {hasValidationIssues && (
        <>
          <div
            id="process-validation-details"
            className={[
              "process-validation-summary__details",
              isExpanded
                ? "process-validation-summary__details--expanded"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <ValidationIssueGroup
              headingId="process-validation-errors-heading"
              heading="Errors"
              issues={errorIssues}
              variant="error"
              isExpanded={isExpanded}
            />

            <ValidationIssueGroup
              headingId="process-validation-warnings-heading"
              heading="Warnings"
              issues={warningIssues}
              variant="warning"
              isExpanded={isExpanded}
            />
          </div>

          {hasHiddenIssues && (
            <button
              type="button"
              className="process-validation-summary__toggle"
              onClick={handleToggleExpanded}
              aria-expanded={isExpanded}
              aria-controls="process-validation-details"
            >
              {isExpanded
                ? "Hide issue details"
                : `Show all ${validationIssues.length} issues`}
            </button>
          )}
        </>
      )}
    </section>
  );
};

export default ProcessValidationSummary;