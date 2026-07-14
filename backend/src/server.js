// ========================================
// Core Dependencies
// ========================================

const express = require("express");
const cors = require("cors");
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
// Global Middleware
// ========================================

/**
 * Enables Cross-Origin Resource Sharing so the React frontend can communicate
 * with the backend while both applications run on separate local ports.
 *
 * This unrestricted development configuration should later be replaced with an
 * environment-based allowlist before production deployment.
 */
app.use(cors());

/**
 * Parses incoming JSON request bodies and exposes the resulting values through
 * `req.body`.
 *
 * The requirements-analysis endpoint depends on this middleware because the
 * frontend submits business requirements as JSON.
 */
app.use(express.json());

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
// Application Routes
// ========================================

/**
 * Mounts requirements-analysis routes beneath the shared `/api` prefix.
 *
 * The `/analyze` route declared inside `analysisRoutes` is therefore exposed as:
 * POST `/api/analyze`
 */
app.use("/api", analysisRoutes);

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