// ========================================
// Core Dependencies
// ========================================

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");

// ========================================
// Environment Configuration
// ========================================

/**
 * Loads environment variables before importing any application modules.
 *
 * Several services read configuration values such as:
 * - ANALYSIS_MODE
 * - AI_PROVIDER
 * - OPENAI_API_KEY
 * - OPENAI_MODEL
 *
 * Loading the environment first prevents those modules from seeing undefined
 * values and incorrectly falling back to development defaults such as mock
 * analysis mode.
 */
dotenv.config();

// ========================================
// Application Route Modules
// ========================================

/**
 * Route modules are imported only after environment configuration is loaded.
 *
 * Some routes depend on services that inspect server-side configuration during
 * module initialization, so import order is important.
 */
const analysisRoutes = require("./routes/analysisRoutes");

// ========================================
// Express Application Setup
// ========================================

const app = express();
const PORT = process.env.PORT || 3001;

// ========================================
// Cross-Origin Request Configuration
// ========================================

/**
 * Converts the comma-separated frontend-origin environment variable into a
 * normalized allowlist.
 *
 * Example:
 * FRONTEND_ORIGINS=http://localhost:5173,https://example.com
 */
const configuredFrontendOrigins = (
  process.env.FRONTEND_ORIGINS || ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * Local Vite origins remain available during development without requiring
 * additional environment configuration.
 */
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? configuredFrontendOrigins
    : [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        ...configuredFrontendOrigins,
      ];

// ========================================
// Global Middleware
// ========================================

/**
 * Adds defensive HTTP response headers to reduce exposure to common browser
 * and transport-level attacks.
 *
 * Strict Transport Security is disabled during local development so browsers
 * do not attempt to force localhost traffic from HTTP to HTTPS.
 */
app.use(
  helmet({
    strictTransportSecurity:
      process.env.NODE_ENV === "production"
        ? undefined
        : false,

    contentSecurityPolicy: {
      directives: {
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production"
            ? []
            : null,
      },
    },
  })
);

/**
 * Restricts browser-based API access to explicitly approved frontend origins.
 *
 * Requests without an Origin header remain supported for tools such as curl,
 * deployment health checks, and server-to-server communication.
 */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          "Cross-origin requests from this origin are not allowed."
        )
      );
    },
    methods: [
      "GET",
      "POST",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
    ],
  })
);

/**
 * Parses incoming JSON request bodies while enforcing a conservative payload
 * limit.
 *
 * Business-requirements submissions are text-based and should not require large
 * request bodies. Rejecting oversized payloads reduces accidental or malicious
 * memory consumption.
 */
app.use(
  express.json({
    limit: process.env.JSON_BODY_LIMIT || "100kb",
  })
);

// ========================================
// Health Check Route
// ========================================

/**
 * Provides a lightweight endpoint for confirming that the API process is
 * running and responding successfully.
 *
 * Deployment platforms, containers, reverse proxies, and monitoring tools can
 * later use this endpoint as a health check.
 */
app.get("/api/health", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "Requirements Flow Agent API",
  });
});

// ========================================
// Analysis Request Rate Limiting
// ========================================

/**
 * Limits repeated analysis requests from the same client.
 *
 * AI-backed analysis can consume paid provider capacity, so this limiter helps
 * reduce accidental request loops and basic abuse while leaving health checks
 * unaffected.
 */
const analysisRateLimiter = rateLimit({
  windowMs: Number(
    process.env.ANALYSIS_RATE_LIMIT_WINDOW_MS || 60_000
  ),
  limit: Number(
    process.env.ANALYSIS_RATE_LIMIT_MAX_REQUESTS || 10
  ),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error:
      "Too many analysis requests. Please wait before trying again.",
  },
});

// ========================================
// Application Routes
// ========================================

/**
 * Mounts requirements-analysis routes beneath the shared `/api` prefix.
 *
 * The `/analyze` route declared inside `analysisRoutes` is therefore exposed as:
 * POST `/api/analyze`
 */
app.use(
  "/api/analyze",
  analysisRateLimiter
);

app.use("/api", analysisRoutes);

// ========================================
// Not Found and Error Handling
// ========================================

/**
 * Returns a consistent JSON response for requests that do not match a known
 * API route.
 */
app.use((req, res) => {
  return res.status(404).json({
    error: "The requested API route was not found.",
  });
});

/**
 * Converts unexpected middleware and routing failures into a production-safe
 * JSON response.
 *
 * Detailed error information is logged on the server but is not exposed to
 * clients in production.
 */
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  console.error("Unhandled API error:", error);

  const isProduction =
    process.env.NODE_ENV === "production";

  return res.status(
    Number.isInteger(error.status)
      ? error.status
      : 500
  ).json({
    error: isProduction
      ? "An unexpected server error occurred."
      : error.message ||
        "An unexpected server error occurred.",
  });
});

// ========================================
// Server Startup
// ========================================

/**
 * Starts the HTTP server and listens for incoming requests.
 *
 * The configured environment port is preferred, while port 3001 remains the
 * local-development fallback.
 */
app.listen(PORT, () => {
  console.log(`Requirements Flow Agent API running on port ${PORT}`);
  console.log(
    `Analysis mode: ${process.env.ANALYSIS_MODE || "mock"}`
  );
  console.log(
    `AI provider: ${process.env.AI_PROVIDER || "not configured"}`
  );
});