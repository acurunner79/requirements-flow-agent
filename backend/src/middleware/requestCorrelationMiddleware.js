// ========================================
// Core Dependencies
// ========================================

const crypto = require("node:crypto");

// ========================================
// Request Correlation Middleware
// ========================================

/**
 * Assigns one correlation identifier to every incoming API request.
 *
 * A client-supplied `X-Request-ID` value is preserved when it contains usable
 * text. Otherwise, the backend creates a UUID using Node's cryptographic random
 * identifier generator.
 *
 * The identifier is:
 * - Stored on `req.requestId` for controllers and services
 * - Returned through the `X-Request-ID` response header
 * - Available to server logs without recording request-body content
 *
 * @param {import("express").Request} req
 * Incoming Express request.
 *
 * @param {import("express").Response} res
 * Express response used to expose the correlation header.
 *
 * @param {import("express").NextFunction} next
 * Function that continues the middleware chain.
 *
 * @returns {void}
 */
const requestCorrelationMiddleware = (
  req,
  res,
  next
) => {
  const suppliedRequestId =
    req.get("X-Request-ID");

  const requestId =
    typeof suppliedRequestId === "string" &&
    suppliedRequestId.trim()
      ? suppliedRequestId.trim()
      : crypto.randomUUID();

  req.requestId = requestId;

  res.setHeader(
    "X-Request-ID",
    requestId
  );

  next();
};

module.exports = {
  requestCorrelationMiddleware,
};