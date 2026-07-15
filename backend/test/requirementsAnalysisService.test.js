const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAiProcessModelFactory,
  createMockProcessModel,
  validateAnalysisMode,
} = require("../src/services/requirementsAnalysisService");

// ========================================
// Mock Process Model Tests
// ========================================

/**
 * Confirms that mock analysis returns the deterministic fixture while trimming
 * the submitted requirements before storing them as source traceability data.
 */
test("creates a trimmed mock process model", () => {
  const processModel = createMockProcessModel(
    "   Review vendor invoices.   "
  );

  assert.equal(
    processModel.processName,
    "Vendor Invoice Review"
  );

  assert.equal(
    processModel.sourceText,
    "Review vendor invoices."
  );

  assert.ok(Array.isArray(processModel.actors));
  assert.ok(Array.isArray(processModel.steps));
  assert.ok(Array.isArray(processModel.warnings));

  processModel.steps.forEach((step) => {
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
 * Confirms that every mock request receives an independent deep clone.
 *
 * Mutating one returned process model must not alter another response or the
 * shared fixture stored in Node's module cache.
 */
test("creates independent mock process model copies", () => {
  const firstModel = createMockProcessModel(
    "First request"
  );

  const secondModel = createMockProcessModel(
    "Second request"
  );

  firstModel.processName = "Changed Process";
  firstModel.actors.push("Temporary Actor");
  firstModel.steps[0].label = "Changed step";
  firstModel.steps[0].connections.push({
    targetStepId: "STEP-999",
    label: "Temporary",
  });

  assert.equal(
    secondModel.processName,
    "Vendor Invoice Review"
  );

  assert.equal(
    secondModel.actors.includes("Temporary Actor"),
    false
  );

  assert.equal(
    secondModel.steps[0].label,
    "Invoice received"
  );

  assert.equal(
    secondModel.steps[0].connections.some(
      (connection) =>
        connection.targetStepId === "STEP-999"
    ),
    false
  );
});

// ========================================
// Analysis Mode Validation Tests
// ========================================

/**
 * Confirms that every supported analysis mode passes validation without
 * throwing an error.
 */
test("accepts supported analysis modes", () => {
  assert.doesNotThrow(() =>
    validateAnalysisMode("mock")
  );

  assert.doesNotThrow(() =>
    validateAnalysisMode("ai")
  );
});

/**
 * Confirms that unsupported analysis modes fail with a descriptive
 * configuration error instead of silently falling back to another mode.
 */
test("rejects unsupported analysis modes", () => {
  assert.throws(
    () =>
      validateAnalysisMode("recorded"),
    {
      message:
        "Unsupported ANALYSIS_MODE: recorded. Supported modes are: mock, ai.",
    }
  );
});

// ========================================
// AI Process Workflow Tests
// ========================================

/**
 * Confirms that the AI workflow:
 * - Builds a prompt from the submitted requirements
 * - Sends that prompt to the provider boundary
 * - Passes the raw provider response to the response processor
 * - Returns the normalized process model unchanged
 *
 * Every dependency is local and deterministic, so this test cannot contact a
 * live AI provider or consume API tokens.
 */
test("runs the complete AI process workflow through injected dependencies", async () => {
  let receivedRequirements = null;
  let receivedPrompt = null;
  let receivedProviderResponse = null;

  const expectedProcessModel = {
    processName: "Refund Review",
    actors: [
      "Customer Service",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "end",
        label: "Refund review completed",
        owner: "Customer Service",
        connections: [],
      },
    ],
    warnings: [],
  };

  const promptBuilder = (requirements) => {
    receivedRequirements = requirements;

    return `Analyze these requirements: ${requirements}`;
  };

  const providerAnalyzer = async (prompt) => {
    receivedPrompt = prompt;

    return "{\"raw\":\"provider response\"}";
  };

  const responseProcessor = (responseText) => {
    receivedProviderResponse = responseText;

    return expectedProcessModel;
  };

  const analyzeWithInjectedWorkflow =
    createAiProcessModelFactory({
      promptBuilder,
      providerAnalyzer,
      responseProcessor,
    });

  const result = await analyzeWithInjectedWorkflow(
    "Review refund requests."
  );

  assert.equal(
    receivedRequirements,
    "Review refund requests."
  );

  assert.equal(
    receivedPrompt,
    "Analyze these requirements: Review refund requests."
  );

  assert.equal(
    receivedProviderResponse,
    "{\"raw\":\"provider response\"}"
  );

  assert.equal(result, expectedProcessModel);
});

/**
 * Confirms that provider failures propagate to the controller boundary instead
 * of being swallowed or replaced inside the service layer.
 *
 * The controller is responsible for converting this failure into an HTTP 500
 * response.
 */
test("propagates provider failures from the AI workflow", async () => {
  const analyzeWithInjectedWorkflow =
    createAiProcessModelFactory({
      promptBuilder: () => "Generated prompt",

      providerAnalyzer: async () => {
        throw new Error("Provider request failed.");
      },

      responseProcessor: () => {
        throw new Error(
          "Response processor should not run after provider failure."
        );
      },
    });

  await assert.rejects(
    () =>
      analyzeWithInjectedWorkflow(
        "Review refund requests."
      ),
    {
      message: "Provider request failed.",
    }
  );
});

// ========================================
// AI Corrective Retry Recovery Tests
// ========================================

/**
 * Confirms that the first invalid provider response triggers exactly one
 * corrective request.
 */

/**
 * Confirms that the corrected response is processed and returned successfully.
 */

/**
 * Confirms that both the provider and response processor run exactly twice.
 */
test(
  "returns a corrected process model after one response-processing failure",
  async () => {
    const originalPrompt =
      "Original process-analysis prompt";

    const correctionPrompt =
      "Corrective process-analysis prompt";

    const correctedProcessModel = {
      processName: "Recovered Process",
      actors: ["Operations"],
      steps: [
        {
          id: "STEP-001",
          type: "start",
          label: "Begin",
          owner: "Operations",
          connections: [
            {
              targetStepId: "STEP-002",
              label: "",
            },
          ],
        },
        {
          id: "STEP-002",
          type: "end",
          label: "Complete",
          owner: "Operations",
          connections: [],
        },
      ],
      warnings: [],
    };

    const providerResponses = [
      "invalid provider response",
      "corrected provider response",
    ];

    let providerCallCount = 0;
    let responseProcessorCallCount = 0;

    const warningLogs = [];
    const infoLogs = [];
    const errorLogs = [];

    const createProcessModel =
      createAiProcessModelFactory({
        promptBuilder: () =>
          originalPrompt,

        correctionPromptBuilder: (
          receivedOriginalPrompt,
          invalidResponse,
          processingError
        ) => {
          assert.equal(
            receivedOriginalPrompt,
            originalPrompt
          );

          assert.equal(
            invalidResponse,
            providerResponses[0]
          );

          assert.equal(
            processingError.message,
            "The AI provider returned invalid JSON for the process model."
          );

          return correctionPrompt;
        },

        providerAnalyzer: async (prompt) => {
          if (providerCallCount === 0) {
            assert.equal(
              prompt,
              originalPrompt
            );
          } else {
            assert.equal(
              prompt,
              correctionPrompt
            );
          }

          const response =
            providerResponses[providerCallCount];

          providerCallCount += 1;

          return response;
        },

        responseProcessor: (responseText) => {
          responseProcessorCallCount += 1;

          if (
            responseText ===
            providerResponses[0]
          ) {
            throw new Error(
              "The AI provider returned invalid JSON for the process model."
            );
          }

          return correctedProcessModel;
        },
        logger: {
          warn: (message, details) => {
            warningLogs.push({
              message,
              details,
            });
          },

          info: (message, details) => {
            infoLogs.push({
              message,
              details,
            });
          },

          error: (message, details) => {
            errorLogs.push({
              message,
              details,
            });
          },
        },
      });

    const result =
      await createProcessModel(
        "Analyze this process."
      );

    assert.deepEqual(
      result,
      correctedProcessModel
    );

    assert.equal(
      providerCallCount,
      2
    );

    assert.equal(
      responseProcessorCallCount,
      2
    );

    /**
     * Confirms that the retry-started event records only controlled diagnostic
     * information.
     */
    assert.deepEqual(
      warningLogs,
      [
        {
          message:
            "AI process response required corrective retry.",
          details: {
            event:
              "ai_process_correction_started",
            errorName: "Error",
            errorMessage:
              "The AI provider returned invalid JSON for the process model.",
          },
        },
      ]
    );

    /**
     * Confirms that successful recovery produces one completion event.
     */
    assert.deepEqual(
      infoLogs,
      [
        {
          message:
            "AI process response recovered after corrective retry.",
          details: {
            event:
              "ai_process_correction_succeeded",
          },
        },
      ]
    );

    /**
     * A successful recovery must not produce a corrective-failure event.
     */
    assert.deepEqual(
      errorLogs,
      []
    );
  }
);

/**
 * Confirms that a second response-processing failure is logged and propagated
 * unchanged after exactly one corrective attempt.
 *
 * This protects JSON parsing and normalization diagnostics while preventing an
 * unbounded retry loop.
 */
test(
  "propagates response-processing failures after one corrective retry",
  async () => {
    const processAnalysisPrompt =
      "Original process-analysis prompt";

    const correctionPrompt =
      "Corrective process-analysis prompt";

    const providerResponses = [
      "invalid response",
      "still invalid response",
    ];

    let providerCallCount = 0;

    const warningLogs = [];
    const infoLogs = [];
    const errorLogs = [];

    const createProcessModel =
      createAiProcessModelFactory({
        promptBuilder: () =>
          processAnalysisPrompt,

        correctionPromptBuilder: (
          originalPrompt,
          invalidResponse,
          processingError
        ) => {
          assert.equal(
            originalPrompt,
            processAnalysisPrompt
          );

          assert.equal(
            invalidResponse,
            providerResponses[0]
          );

          assert.equal(
            processingError.message,
            "The AI provider returned invalid JSON for the process model."
          );

          return correctionPrompt;
        },

        providerAnalyzer: async (prompt) => {
          if (providerCallCount === 0) {
            assert.equal(
              prompt,
              processAnalysisPrompt
            );
          } else {
            assert.equal(
              prompt,
              correctionPrompt
            );
          }

          const response =
            providerResponses[providerCallCount];

          providerCallCount += 1;

          return response;
        },

        responseProcessor: () => {
          throw new Error(
            "The AI provider returned invalid JSON for the process model."
          );
        },
        logger: {
          warn: (message, details) => {
            warningLogs.push({
              message,
              details,
            });
          },

          info: (message, details) => {
            infoLogs.push({
              message,
              details,
            });
          },

          error: (message, details) => {
            errorLogs.push({
              message,
              details,
            });
          },
        },
      });
 

    await assert.rejects(
      () =>
        createProcessModel(
          "Analyze this process."
        ),
      {
        message:
          "The AI provider returned invalid JSON for the process model.",
      }
    );

    assert.equal(
      providerCallCount,
      2
    );
    /**
     * Confirms that the initial processing failure starts one corrective retry.
     */
    assert.deepEqual(
      warningLogs,
      [
        {
          message:
            "AI process response required corrective retry.",
          details: {
            event:
              "ai_process_correction_started",
            errorName: "Error",
            errorMessage:
              "The AI provider returned invalid JSON for the process model.",
          },
        },
      ]
    );

    /**
     * A failed correction must not produce a success event.
     */
    assert.deepEqual(
      infoLogs,
      []
    );

    /**
     * Confirms that the final processing failure is recorded once before being
     * propagated to the caller.
     */
    assert.deepEqual(
      errorLogs,
      [
        {
          message:
            "AI process corrective retry failed.",
          details: {
            event:
              "ai_process_correction_failed",
            errorName: "Error",
            errorMessage:
              "The AI provider returned invalid JSON for the process model.",
          },
        },
      ]
    );
  }
);