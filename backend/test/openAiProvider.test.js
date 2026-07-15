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

// ========================================
// OpenAI Error Classification Tests
// ========================================

describe("OpenAI provider error classification", () => {
  /**
   * Loads the classifier with valid provider configuration so the module can be
   * imported consistently across all error scenarios.
   *
   * @returns {(error: unknown) => Error}
   * OpenAI service-error classifier.
   */
  const loadErrorClassifier = () => {
    process.env.OPENAI_API_KEY = "test-api-key";
    process.env.OPENAI_MODEL = "test-model";
    process.env.OPENAI_MAX_OUTPUT_TOKENS = "6000";
    process.env.OPENAI_TIMEOUT_MS = "60000";
    process.env.OPENAI_MAX_RETRIES = "2";

    const {
      createOpenAiServiceError,
    } = loadOpenAiProvider();

    return createOpenAiServiceError;
  };

  /**
   * Confirms that provider timeouts receive a retry-friendly message.
   */
  test("classifies OpenAI timeout errors", () => {
    const createOpenAiServiceError =
      loadErrorClassifier();

    const providerError = {
      name: "APIConnectionTimeoutError",
    };

    const serviceError =
      createOpenAiServiceError(providerError);

    assert.equal(
      serviceError.message,
      "OpenAI analysis timed out. Please try again."
    );
  });

  /**
   * Confirms that authentication failures do not expose the raw SDK response.
   */
  test("classifies OpenAI authentication failures", () => {
    const createOpenAiServiceError =
      loadErrorClassifier();

    const serviceError =
      createOpenAiServiceError({
        name: "AuthenticationError",
        status: 401,
        message: "Raw provider credential details",
      });

    assert.equal(
      serviceError.message,
      "OpenAI authentication failed. Verify the backend API credentials."
    );

    assert.equal(
      serviceError.message.includes(
        "Raw provider credential details"
      ),
      false
    );
  });

  /**
   * Confirms that provider rate limits produce a temporary-failure message.
   */
  test("classifies OpenAI rate-limit failures", () => {
    const createOpenAiServiceError =
      loadErrorClassifier();

    const serviceError =
      createOpenAiServiceError({
        name: "RateLimitError",
        status: 429,
      });

    assert.equal(
      serviceError.message,
      "OpenAI is temporarily rate limited. Please wait and try again."
    );
  });

  /**
   * Confirms that provider-side server failures are treated as temporary
   * availability problems.
   */
  test("classifies OpenAI server failures", () => {
    const createOpenAiServiceError =
      loadErrorClassifier();

    const serviceError =
      createOpenAiServiceError({
        name: "InternalServerError",
        status: 503,
      });

    assert.equal(
      serviceError.message,
      "OpenAI is temporarily unavailable. Please try again."
    );
  });

  /**
   * Confirms that unrecognized SDK failures receive a stable fallback message
   * instead of leaking the original provider details.
   */
  test("uses a safe fallback for unknown OpenAI failures", () => {
    const createOpenAiServiceError =
      loadErrorClassifier();

    const serviceError =
      createOpenAiServiceError({
        name: "UnexpectedProviderFailure",
        message: "Sensitive provider details",
      });

    assert.equal(
      serviceError.message,
      "OpenAI process analysis failed unexpectedly."
    );

    assert.equal(
      serviceError.message.includes(
        "Sensitive provider details"
      ),
      false
    );
  });
});