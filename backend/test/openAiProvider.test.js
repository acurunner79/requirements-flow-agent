// ========================================
// Node Test Dependencies
// ========================================

const {
  afterEach,
  describe,
  test,
} = require("node:test");

const assert = require("node:assert/strict");

// ========================================
// Test Environment Helpers
// ========================================

/**
 * Clears the provider module from Node's require cache.
 *
 * The OpenAI adapter reads environment variables when the module is imported,
 * so each configuration test must load a fresh copy after changing `process.env`.
 *
 * @returns {object}
 * Freshly loaded OpenAI provider module.
 */
const loadOpenAiProvider = () => {
  const modulePath = require.resolve(
    "../src/providers/openAiProvider"
  );

  delete require.cache[modulePath];

  return require(modulePath);
};

/**
 * Stores the original environment values so each test can restore them after
 * exercising an alternate configuration.
 */
const originalEnvironment = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_MAX_OUTPUT_TOKENS:
    process.env.OPENAI_MAX_OUTPUT_TOKENS,
  OPENAI_TIMEOUT_MS: process.env.OPENAI_TIMEOUT_MS,
  OPENAI_MAX_RETRIES: process.env.OPENAI_MAX_RETRIES,
};

/**
 * Restores every OpenAI-related environment variable after each test.
 */
afterEach(() => {
  Object.entries(originalEnvironment).forEach(
    ([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
        return;
      }

      process.env[key] = value;
    }
  );
});

// ========================================
// OpenAI Configuration Validation Tests
// ========================================

describe("OpenAI provider configuration", () => {
  /**
   * Confirms that valid timeout and retry settings are accepted.
   */
  test("accepts valid timeout and retry configuration", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    process.env.OPENAI_MODEL = "test-model";
    process.env.OPENAI_MAX_OUTPUT_TOKENS = "6000";
    process.env.OPENAI_TIMEOUT_MS = "60000";
    process.env.OPENAI_MAX_RETRIES = "2";

    const {
      validateOpenAiConfiguration,
    } = loadOpenAiProvider();

    assert.doesNotThrow(() => {
      validateOpenAiConfiguration();
    });
  });

  /**
   * Confirms that non-positive timeout values are rejected before creating an
   * SDK client.
   */
  test("rejects an invalid OpenAI timeout", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    process.env.OPENAI_MODEL = "test-model";
    process.env.OPENAI_TIMEOUT_MS = "0";
    process.env.OPENAI_MAX_RETRIES = "2";

    const {
      validateOpenAiConfiguration,
    } = loadOpenAiProvider();

    assert.throws(
      () => {
        validateOpenAiConfiguration();
      },
      {
        message:
          "OPENAI_TIMEOUT_MS must be a positive integer.",
      }
    );
  });

  /**
   * Confirms that retry counts cannot be negative.
   */
  test("rejects a negative OpenAI retry count", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    process.env.OPENAI_MODEL = "test-model";
    process.env.OPENAI_TIMEOUT_MS = "60000";
    process.env.OPENAI_MAX_RETRIES = "-1";

    const {
      validateOpenAiConfiguration,
    } = loadOpenAiProvider();

    assert.throws(
      () => {
        validateOpenAiConfiguration();
      },
      {
        message:
          "OPENAI_MAX_RETRIES must be a non-negative integer.",
      }
    );
  });

  /**
   * Confirms that non-numeric retry values are rejected.
   */
  test("rejects a non-numeric OpenAI retry count", () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    process.env.OPENAI_MODEL = "test-model";
    process.env.OPENAI_TIMEOUT_MS = "60000";
    process.env.OPENAI_MAX_RETRIES = "invalid";

    const {
      validateOpenAiConfiguration,
    } = loadOpenAiProvider();

    assert.throws(
      () => {
        validateOpenAiConfiguration();
      },
      {
        message:
          "OPENAI_MAX_RETRIES must be a non-negative integer.",
      }
    );
  });
});