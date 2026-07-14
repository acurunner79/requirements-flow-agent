// ========================================
// Dependencies
// ========================================

const express = require("express");
const {
  analyzeRequirements,
} = require("../controllers/analysisController");

// ========================================
// Router Setup
// ========================================

const router = express.Router();

// ========================================
// Requirements Analysis Routes
// ========================================

/**
 * POST /api/analyze
 *
 * Accepts pasted business-requirements text and returns a structured process
 * model. The route delegates all validation and process-generation behavior to
 * the controller so this file remains focused on URL and HTTP-method mapping.
 */
router.post("/analyze", analyzeRequirements);

module.exports = router;