// ========================================
// Request Validation Utilities
// ========================================

/**
 * Determines whether a business-requirements value contains usable text.
 *
 * This utility is intentionally kept separate from the route and controller
 * layers so the same validation rule can be reused later by file uploads,
 * pasted-text submissions, background jobs, or automated tests.
 *
 * @param {unknown} requirements - The value supplied by the client.
 * @returns {boolean} True when the value is a non-empty string after trimming.
 */
const hasValidRequirementsText = (requirements) => {
  return (
    typeof requirements === "string" &&
    requirements.trim().length > 0
  );
};

module.exports = {
  hasValidRequirementsText,
};