const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PROCESS_MODEL_RESPONSE_EXAMPLE,
  SUPPORTED_PROCESS_STEP_TYPES,
  buildProcessAnalysisPrompt,
} = require("../src/utils/processPromptUtils");

// ========================================
// Prompt Construction Tests
// ========================================

/**
 * Confirms that submitted requirements are trimmed and embedded in the final
 * provider-neutral analysis prompt.
 */
test("builds a prompt containing normalized business requirements", () => {
  const prompt = buildProcessAnalysisPrompt(
    "   Review vendor invoices and route exceptions.   "
  );

  assert.match(
    prompt,
    /BUSINESS REQUIREMENTS\s+Review vendor invoices and route exceptions\.$/
  );

  assert.equal(
    prompt.includes(
      "   Review vendor invoices and route exceptions.   "
    ),
    false
  );
});

/**
 * Confirms that the prompt requires the authoritative rich connection model and
 * explicitly prohibits the retired identifier-only connection property.
 */
test("requires rich connections and prohibits nextStepIds", () => {
  const prompt = buildProcessAnalysisPrompt(
    "Review refund requests."
  );

  assert.match(
    prompt,
    /Every non-end step must include a connections array/
  );

  assert.match(
    prompt,
    /targetStepId/
  );

  assert.match(
    prompt,
    /label/
  );

  assert.match(
    prompt,
    /Do not include the legacy nextStepIds property/
  );

  assert.match(
    prompt,
    /normalized application model must expose only the rich connections/
  );
});

/**
 * Confirms that every supported process-step type is included in the prompt
 * contract.
 */
test("includes every supported process step type", () => {
  const prompt = buildProcessAnalysisPrompt(
    "Review refund requests."
  );

  SUPPORTED_PROCESS_STEP_TYPES.forEach((stepType) => {
    assert.equal(
      prompt.includes(stepType),
      true
    );
  });
});

/**
 * Confirms that the response example remains serializable JSON-compatible data
 * and contains only rich connection objects.
 */
test("provides a valid rich-connection response example", () => {
  const serializedExample = JSON.stringify(
    PROCESS_MODEL_RESPONSE_EXAMPLE
  );

  const parsedExample = JSON.parse(serializedExample);

  assert.equal(
    parsedExample.processName,
    "Customer Refund Review"
  );

  parsedExample.steps.forEach((step) => {
    assert.ok(Array.isArray(step.connections));

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        step,
        "nextStepIds"
      ),
      false
    );
  });
});

/**
 * Confirms that missing, blank, or non-string requirements are rejected before
 * prompt construction begins.
 */
test("rejects invalid requirements during prompt construction", () => {
  const expectedMessage =
    "Valid business requirements are required to build the analysis prompt.";

  assert.throws(
    () => buildProcessAnalysisPrompt(""),
    {
      message: expectedMessage,
    }
  );

  assert.throws(
    () => buildProcessAnalysisPrompt("   "),
    {
      message: expectedMessage,
    }
  );

  assert.throws(
    () => buildProcessAnalysisPrompt(null),
    {
      message: expectedMessage,
    }
  );
});