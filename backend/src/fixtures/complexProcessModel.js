// ========================================
// Complex Process Model Fixture
// ========================================

/**
 * Provides a reusable process model for local development and regression tests.
 *
 * This fixture intentionally includes:
 * - Multiple actors
 * - Standard process steps
 * - Two decision points
 * - Labeled branches
 * - Rich outgoing `connections` with labeled decision branches
 * - One warning for validation-summary testing
 *
 * Using a stable fixture prevents routine frontend, validation, and export tests
 * from consuming paid AI-provider tokens.
 */
const complexProcessModelFixture = {
  processName: "Vendor Invoice Review",

  actors: [
    "Accounts Payable",
    "Procurement",
    "Vendor Management",
    "Finance Manager",
  ],

  steps: [
    {
      id: "STEP-001",
      type: "start",
      label: "Invoice received",
      owner: "Accounts Payable",
      connections: [
        {
          targetStepId: "STEP-002",
          label: "",
        },
      ],
    },
    {
      id: "STEP-002",
      type: "process",
      label: "Capture invoice details",
      owner: "Accounts Payable",
      connections: [
        {
          targetStepId: "STEP-003",
          label: "",
        },
      ],
    },
    {
      id: "STEP-003",
      type: "decision",
      label: "Is the vendor active?",
      owner: "Accounts Payable",
      connections: [
        {
          targetStepId: "STEP-004",
          label: "No",
        },
        {
          targetStepId: "STEP-005",
          label: "Yes",
        },
      ],
    },
    {
      id: "STEP-004",
      type: "process",
      label: "Route to Vendor Management for review",
      owner: "Vendor Management",
      connections: [
        {
          targetStepId: "STEP-005",
          label: "",
        },
      ],
    },
    {
      id: "STEP-005",
      type: "decision",
      label: "Does the three-way match succeed?",
      owner: "Accounts Payable",
      connections: [
        {
          targetStepId: "STEP-006",
          label: "No",
        },
        {
          targetStepId: "STEP-007",
          label: "Yes",
        },
      ],
    },
    {
      id: "STEP-006",
      type: "process",
      label: "Resolve invoice discrepancy",
      owner: "Procurement",
      connections: [
        {
          targetStepId: "STEP-005",
          label: "Retry",
        },
      ],
    },
    {
      id: "STEP-007",
      type: "decision",
      label: "Is finance approval required?",
      owner: "Accounts Payable",
      connections: [
        {
          targetStepId: "STEP-008",
          label: "Yes",
        },
        {
          targetStepId: "STEP-009",
          label: "No",
        },
      ],
    },
    {
      id: "STEP-008",
      type: "process",
      label: "Approve invoice",
      owner: "Finance Manager",
      connections: [
        {
          targetStepId: "STEP-009",
          label: "",
        },
      ],
    },
    {
      id: "STEP-009",
      type: "process",
      label: "Schedule invoice payment",
      owner: "Accounts Payable",
      connections: [
        {
          targetStepId: "STEP-010",
          label: "",
        },
      ],
    },
    {
      id: "STEP-010",
      type: "end",
      label: "Invoice review completed",
      owner: "Accounts Payable",
      connections: [],
    },
  ],

  warnings: [
    {
      code: "MISSING_APPROVAL_THRESHOLD",
      message:
        "The requirements do not define when finance approval is required.",
    },
  ],
};

module.exports = {
  complexProcessModelFixture,
};