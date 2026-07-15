const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");

const analysisRoutes = require("../src/routes/analysisRoutes");

// ========================================
// Test Application Setup
// ========================================

/**
 * Creates a lightweight Express application containing only the middleware and
 * route required by the analysis API tests.
 *
 * This avoids starting the production server or opening a network port.
 *
 * @returns {import("express").Express}
 * Isolated Express application used by Supertest.
 */
const createTestApp = () => {
  const app = express();

  app.use(express.json());
  app.use("/api", analysisRoutes);

  return app;
};

// ========================================
// POST /api/analyze Tests
// ========================================

test("POST /api/analyze returns the mock process model", async () => {
  const app = createTestApp();

  const response = await request(app)
    .post("/api/analyze")
    .send({
      requirements:
        "Review vendor invoices and route exceptions for approval.",
    });

  assert.equal(response.status, 200);
  assert.equal(response.body.processName, "Vendor Invoice Review");

  assert.equal(
    response.body.sourceText,
    "Review vendor invoices and route exceptions for approval."
  );

  assert.ok(Array.isArray(response.body.actors));
  assert.ok(Array.isArray(response.body.steps));
  assert.ok(Array.isArray(response.body.warnings));

  assert.ok(response.body.steps.length > 0);

  response.body.steps.forEach((step) => {
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

// ========================================
// Requirements Input Validation Tests
// ========================================

/**
 * Confirms that the analysis endpoint rejects requests that omit the
 * `requirements` property entirely.
 *
 * This validation must occur before the analysis service is called so missing
 * input cannot trigger mock processing or a paid AI-provider request.
 */
test("POST /api/analyze rejects missing requirements", async () => {
  const app = createTestApp();

  const response = await request(app)
    .post("/api/analyze")
    .send({});

  assert.equal(response.status, 400);

  assert.deepEqual(response.body, {
    error: "Business requirements are required.",
  });
});

/**
 * Confirms that strings containing only whitespace are treated as missing
 * business requirements.
 *
 * Accepting whitespace-only input would produce an unusable prompt and an empty
 * source-text value after normalization.
 */
test("POST /api/analyze rejects whitespace-only requirements", async () => {
  const app = createTestApp();

  const response = await request(app)
    .post("/api/analyze")
    .send({
      requirements: "   ",
    });

  assert.equal(response.status, 400);

  assert.deepEqual(response.body, {
    error: "Business requirements are required.",
  });
});

/**
 * Confirms that the endpoint accepts only text input for business requirements.
 *
 * Rejecting non-string values keeps the request contract predictable and
 * prevents invalid values from reaching trimming, prompt-building, or provider
 * communication logic.
 */
test("POST /api/analyze rejects non-string requirements", async () => {
  const app = createTestApp();

  const response = await request(app)
    .post("/api/analyze")
    .send({
      requirements: 42,
    });

  assert.equal(response.status, 400);

  assert.deepEqual(response.body, {
    error: "Business requirements are required.",
  });
});

// ========================================
// Requirements Normalization Tests
// ========================================

test("POST /api/analyze trims submitted requirements in mock mode", async () => {
  const app = createTestApp();

  /**
   * Surround the valid requirements text with whitespace to confirm the service
   * normalizes user input before preserving it as source traceability data.
   */
  const response = await request(app)
    .post("/api/analyze")
    .send({
      requirements: "   Review refund requests.   ",
    });

  assert.equal(response.status, 200);

  assert.equal(
    response.body.sourceText,
    "Review refund requests."
  );
});