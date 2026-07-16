const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createAnalyzeRequirementsController,
} = require("../src/controllers/analysisController");

// ========================================
// Test Response Helper
// ========================================

/**
 * Creates a lightweight Express-style response object for direct controller
 * testing.
 *
 * The helper records the selected status code and JSON payload so assertions
 * can verify controller behavior without starting an Express application.
 *
 * @returns {object}
 * Mock response object with Express-compatible `status` and `json` methods.
 */
const createMockResponse = () => {
  return {
    statusCode: null,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(payload) {
      this.body = payload;
      return this;
    },
  };
};

// ========================================
// Controller Service Failure Tests
// ========================================

/**
 * Confirms that an Error thrown by the injected analysis service becomes a
 * 500 response containing the service error message.
 *
 * The failing service is fully local and deterministic, so this test cannot
 * contact an AI provider or consume API tokens.
 */
test("returns a service error message when analysis fails", async () => {
  const failingAnalysisService = async () => {
    throw new Error("Configured provider is unavailable.");
  };

  const controller =
    createAnalyzeRequirementsController(
      failingAnalysisService
    );

  const req = {
    body: {
      requirements: "Review refund requests.",
    },
  };

  const res = createMockResponse();

  /**
   * Suppress the expected controller error log so the test output remains clean.
   */
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await controller(req, res);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 500);

  assert.deepEqual(res.body, {
    error: "Configured provider is unavailable.",
  });
});

/**
 * Confirms that non-Error values thrown by a service do not leak arbitrary
 * internal values to the client.
 *
 * The controller should return its standardized fallback error message instead.
 */
test("returns a safe fallback for non-Error service failures", async () => {
  const failingAnalysisService = async () => {
    throw "unexpected failure";
  };

  const controller =
    createAnalyzeRequirementsController(
      failingAnalysisService
    );

  const req = {
    body: {
      requirements: "Review refund requests.",
    },
  };

  const res = createMockResponse();

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await controller(req, res);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 500);

  assert.deepEqual(res.body, {
    error:
      "An unexpected error occurred while analyzing the requirements.",
  });
});

// ========================================
// Controller Service Success Tests
// ========================================

/**
 * Confirms that valid requirements are passed to the injected analysis service
 * and that the returned process model is sent to the client unchanged.
 *
 * This verifies the controller remains focused on HTTP orchestration rather
 * than modifying provider-independent process data.
 */
test("returns the process model produced by the analysis service", async () => {
  let receivedRequirements = null;

  const expectedProcessModel = {
    processName: "Refund Review",
    actors: [
      "Customer Service",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "end",
        label: "Review completed",
        owner: "Customer Service",
        connections: [],
      },
    ],
    warnings: [],
  };

  const successfulAnalysisService = async (requirements) => {
    receivedRequirements = requirements;
    return expectedProcessModel;
  };

  const controller =
    createAnalyzeRequirementsController(
      successfulAnalysisService
    );

  const req = {
    body: {
      requirements: "Review refund requests.",
    },
  };

  const res = createMockResponse();

  await controller(req, res);

  assert.equal(
    receivedRequirements,
    "Review refund requests."
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body, expectedProcessModel);
});

/**
 * Confirms that the controller forwards its request correlation identifier to
 * the injected analysis service as request-scoped context.
 *
 * The injected service is local and deterministic, so this test cannot contact
 * an AI provider or consume API tokens.
 */
test("passes the request ID to the analysis service", async () => {
  let receivedRequirements = null;
  let receivedContext = null;

  const expectedProcessModel = {
    processName: "Refund Review",
    actors: [
      "Customer Service",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "end",
        label: "Review completed",
        owner: "Customer Service",
        connections: [],
      },
    ],
    warnings: [],
  };

  const successfulAnalysisService = async (
    requirements,
    context
  ) => {
    receivedRequirements = requirements;
    receivedContext = context;

    return expectedProcessModel;
  };

  const controller =
    createAnalyzeRequirementsController(
      successfulAnalysisService
    );

  const req = {
    requestId: "req-controller-correlation-001",
    body: {
      requirements: "Review refund requests.",
    },
  };

  const res = createMockResponse();

  await controller(req, res);

  assert.equal(
    receivedRequirements,
    "Review refund requests."
  );

  assert.deepEqual(
    receivedContext,
    {
      requestId:
        "req-controller-correlation-001",
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body, expectedProcessModel);
});

// ========================================
// Controller Input Validation Tests
// ========================================

/**
 * Confirms that invalid requirements are rejected before the injected analysis
 * service is called.
 *
 * This protects mock processing and paid AI providers from receiving unusable
 * requests.
 */
test("does not call the analysis service for invalid requirements", async () => {
  let serviceCallCount = 0;

  const analysisService = async () => {
    serviceCallCount += 1;

    return {
      processName: "Unexpected Process",
      actors: [],
      steps: [],
      warnings: [],
    };
  };

  const controller =
    createAnalyzeRequirementsController(
      analysisService
    );

  const req = {
    body: {
      requirements: "   ",
    },
  };

  const res = createMockResponse();

  await controller(req, res);

  assert.equal(serviceCallCount, 0);
  assert.equal(res.statusCode, 400);

  assert.deepEqual(res.body, {
    error: "Business requirements are required.",
  });
});