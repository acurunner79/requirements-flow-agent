// ========================================
// Requirements Form Component
// ========================================

/**
 * Renders the business-requirements input form used to start process analysis.
 *
 * This component is intentionally presentation-focused. It receives all
 * current values and event handlers through props rather than owning request
 * logic or API state itself.
 *
 * Keeping the form separate from `App.jsx` makes it easier to:
 * - Reuse the form in a future project workspace or wizard
 * - Test form behavior independently
 * - Expand the input area with file uploads and diagram options later
 * - Prevent the main application component from becoming overly large
 *
 * @param {object} props - Component properties.
 * @param {string} props.requirements - Current requirements text.
 * @param {(value: string) => void} props.onRequirementsChange
 * Updates the requirements text in the parent component.
 * @param {(event: React.FormEvent<HTMLFormElement>) => void} props.onSubmit
 * Handles form submission in the parent component.
 * @param {boolean} props.isAnalyzing
 * Indicates whether an analysis request is currently running.
 * @returns {JSX.Element} The requirements submission form.
 */
const RequirementsForm = ({
  requirements,
  onRequirementsChange,
  onSubmit,
  isAnalyzing,
}) => {
  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="requirements">Business Requirements</label>

      <textarea
        id="requirements"
        name="requirements"
        rows="12"
        value={requirements}
        onChange={(event) => onRequirementsChange(event.target.value)}
        placeholder="Example: A customer submits a refund request. Customer service reviews the request and sends refunds over $500 to a manager for approval."
      />

      <button type="submit" disabled={isAnalyzing}>
        {isAnalyzing ? "Analyzing..." : "Analyze Requirements"}
      </button>
    </form>
  );
};

export default RequirementsForm;