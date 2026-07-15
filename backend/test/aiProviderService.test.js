const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AI_PROVIDERS,
  analyzeWithConfiguredProvider,
  getConfiguredAiProvider,
  getSupportedAiProviders,
  isImplementedAiProvider,
  isSupportedAiProvider,
  validateAiProviderConfiguration,
} = require("../src/services/aiProviderService");

// ========================================
// AI Provider Configuration Tests
// ========================================

/**
 * Preserves the original provider environment value so these tests cannot
 * affect other test files or later application behavior.
 */
const originalAiProvider = process.env.AI_PROVIDER;

test.afterEach(() => {
  if (originalAiProvider === undefined) {
    delete process.env.AI_PROVIDER;
    return;
  }

  process.env.AI_PROVIDER = originalAiProvider;
});

/**
 * Confirms that the configured provider value is trimmed and normalized to
 * lowercase when read from the backend environment.
 */
test("normalizes the configured AI provider", () => {
  process.env.AI_PROVIDER = "  OPENAI  ";

  assert.equal(
    getConfiguredAiProvider(),
    AI_PROVIDERS.OPENAI
  );
});

/**
 * Confirms that missing provider configuration is represented by an empty
 * string so validation can return a precise server configuration error.
 */
test("returns an empty provider when configuration is missing", () => {
  delete process.env.AI_PROVIDER;

  assert.equal(
    getConfiguredAiProvider(),
    ""
  );
});

/**
 * Confirms that every reserved provider identifier is exposed through the
 * supported-provider list.
 */
test("returns all recognized AI providers", () => {
  assert.deepEqual(
    getSupportedAiProviders(),
    [
      AI_PROVIDERS.ANTHROPIC,
      AI_PROVIDERS.OPENAI,
      AI_PROVIDERS.AZURE_OPENAI,
      AI_PROVIDERS.OLLAMA,
    ]
  );
});

/**
 * Confirms that provider support checks are case-insensitive and reject unknown
 * or non-string values.
 */
test("identifies supported AI providers", () => {
  assert.equal(
    isSupportedAiProvider(" OPENAI "),
    true
  );

  assert.equal(
    isSupportedAiProvider("anthropic"),
    true
  );

  assert.equal(
    isSupportedAiProvider("unknown"),
    false
  );

  assert.equal(
    isSupportedAiProvider(null),
    false
  );
});

/**
 * Confirms that only providers with completed adapters are considered
 * implemented.
 */
test("identifies implemented AI providers", () => {
  assert.equal(
    isImplementedAiProvider("openai"),
    true
  );

  assert.equal(
    isImplementedAiProvider("anthropic"),
    false
  );

  assert.equal(
    isImplementedAiProvider("ollama"),
    false
  );
});

// ========================================
// AI Provider Validation Tests
// ========================================

/**
 * Confirms that missing provider configuration produces a clear backend
 * configuration error.
 */
test("rejects missing AI provider configuration", () => {
  assert.throws(
    () =>
      validateAiProviderConfiguration(""),
    {
      message:
        "AI_PROVIDER is not configured on the backend server.",
    }
  );
});

/**
 * Confirms that unknown provider identifiers are rejected with the complete
 * supported-provider list for easier deployment diagnosis.
 */
test("rejects unsupported AI providers", () => {
  assert.throws(
    () =>
      validateAiProviderConfiguration("unknown-provider"),
    {
      message:
        "Unsupported AI provider: unknown-provider. Supported providers are: anthropic, openai, azure-openai, ollama.",
    }
  );
});

/**
 * Confirms that recognized providers without completed adapters fail with a
 * specific implementation-status error.
 */
test("rejects recognized providers without implemented adapters", () => {
  assert.throws(
    () =>
      validateAiProviderConfiguration(
        AI_PROVIDERS.ANTHROPIC
      ),
    {
      message:
        "The anthropic AI provider is recognized, but its adapter has not been implemented yet.",
    }
  );

  assert.throws(
    () =>
      validateAiProviderConfiguration(
        AI_PROVIDERS.OLLAMA
      ),
    {
      message:
        "The ollama AI provider is recognized, but its adapter has not been implemented yet.",
    }
  );
});

/**
 * Confirms that the implemented OpenAI provider passes configuration
 * validation.
 */
test("accepts the implemented OpenAI provider", () => {
  assert.doesNotThrow(() =>
    validateAiProviderConfiguration(
      AI_PROVIDERS.OPENAI
    )
  );
});

// ========================================
// Configured Provider Analysis Validation Tests
// ========================================

/**
 * Confirms that missing or whitespace-only prompts are rejected before provider
 * configuration is read or any provider adapter can be invoked.
 */
test("rejects invalid process-analysis prompts", async () => {
  await assert.rejects(
    () =>
      analyzeWithConfiguredProvider(""),
    {
      message:
        "A valid process-analysis prompt is required.",
    }
  );

  await assert.rejects(
    () =>
      analyzeWithConfiguredProvider("   "),
    {
      message:
        "A valid process-analysis prompt is required.",
    }
  );

  await assert.rejects(
    () =>
      analyzeWithConfiguredProvider(null),
    {
      message:
        "A valid process-analysis prompt is required.",
    }
  );
});

/**
 * Confirms that a valid prompt still fails safely when the backend provider
 * configuration is missing.
 *
 * This test stops at configuration validation and cannot contact OpenAI.
 */
test("rejects valid prompts when AI_PROVIDER is missing", async () => {
  delete process.env.AI_PROVIDER;

  await assert.rejects(
    () =>
      analyzeWithConfiguredProvider(
        "Analyze the submitted business requirements."
      ),
    {
      message:
        "AI_PROVIDER is not configured on the backend server.",
    }
  );
});

/**
 * Confirms that recognized but unimplemented providers fail before any adapter
 * request is attempted.
 */
test("rejects configured providers without implemented adapters", async () => {
  process.env.AI_PROVIDER = AI_PROVIDERS.ANTHROPIC;

  await assert.rejects(
    () =>
      analyzeWithConfiguredProvider(
        "Analyze the submitted business requirements."
      ),
    {
      message:
        "The anthropic AI provider is recognized, but its adapter has not been implemented yet.",
    }
  );
});