const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeProcessModelResponse,
} = require("../src/utils/processResponseUtils");

// ========================================
// Rich Connection Normalization Tests
// ========================================

test("normalizes rich connections without exposing nextStepIds", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Refund Review",
    actors: [
      "Customer Service",
      "Manager",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Refund request received",
        owner: "Customer Service",
        connections: [
          {
            targetStepId: "STEP-002",
            label: "",
          },
        ],
      },
      {
        id: "STEP-002",
        type: "decision",
        label: "Is approval required?",
        owner: "Customer Service",
        connections: [
          {
            targetStepId: "STEP-003",
            label: "Yes",
          },
          {
            targetStepId: "STEP-004",
            label: "No",
          },
        ],
      },
      {
        id: "STEP-003",
        type: "process",
        label: "Approve refund",
        owner: "Manager",
        connections: [
          {
            targetStepId: "STEP-004",
            label: "",
          },
        ],
      },
      {
        id: "STEP-004",
        type: "end",
        label: "Refund review completed",
        owner: "Customer Service",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.steps[1].connections,
    [
      {
        targetStepId: "STEP-003",
        label: "Yes",
      },
      {
        targetStepId: "STEP-004",
        label: "No",
      },
    ]
  );

  normalizedModel.steps.forEach((step) => {
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
// Legacy Provider Input Migration Tests
// ========================================

test("converts legacy nextStepIds input into rich connections", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Legacy Approval Process",
    actors: [
      "Analyst",
      "Manager",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Request received",
        owner: "Analyst",
        nextStepIds: [
          "STEP-002",
        ],
      },
      {
        id: "STEP-002",
        type: "process",
        label: "Review request",
        owner: "Manager",
        nextStepIds: [
          "STEP-003",
        ],
      },
      {
        id: "STEP-003",
        type: "end",
        label: "Request completed",
        owner: "Analyst",
        nextStepIds: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.steps[0].connections,
    [
      {
        targetStepId: "STEP-002",
        label: "",
      },
    ]
  );

  assert.deepEqual(
    normalizedModel.steps[1].connections,
    [
      {
        targetStepId: "STEP-003",
        label: "",
      },
    ]
  );

  assert.deepEqual(
    normalizedModel.steps[2].connections,
    []
  );

  normalizedModel.steps.forEach((step) => {
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
// Rich Connection Priority Tests
// ========================================

test("prefers rich connections over legacy nextStepIds", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Mixed Connection Process",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "decision",
        label: "Choose a route",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-002",
            label: "Approved",
          },
        ],
        nextStepIds: [
          "STEP-003",
        ],
      },
      {
        id: "STEP-002",
        type: "end",
        label: "Approved route completed",
        owner: "Operations",
        connections: [],
      },
      {
        id: "STEP-003",
        type: "end",
        label: "Legacy route completed",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.steps[0].connections,
    [
      {
        targetStepId: "STEP-002",
        label: "Approved",
      },
    ]
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      normalizedModel.steps[0],
      "nextStepIds"
    ),
    false
  );
});

// ========================================
// End Step Normalization Tests
// ========================================

test("removes outgoing connections from end steps", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "End Step Cleanup",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "end",
        label: "Process completed",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-002",
            label: "Invalid",
          },
        ],
        nextStepIds: [
          "STEP-003",
        ],
      },
      {
        id: "STEP-002",
        type: "process",
        label: "Unused step",
        owner: "Operations",
        connections: [],
      },
      {
        id: "STEP-003",
        type: "process",
        label: "Legacy unused step",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.steps[0].connections,
    []
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      normalizedModel.steps[0],
      "nextStepIds"
    ),
    false
  );
});

// ========================================
// Invalid Connection Cleanup Tests
// ========================================

test("removes invalid and duplicate rich connections", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Connection Cleanup",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "decision",
        label: "Select a route",
        owner: "Operations",
        connections: [
          {
            targetStepId: " STEP-002 ",
            label: " Yes ",
          },
          {
            targetStepId: "STEP-002",
            label: "Yes",
          },
          {
            targetStepId: "",
            label: "Invalid",
          },
          null,
          {
            label: "Missing target",
          },
          {
            targetStepId: "STEP-003",
            label: "",
          },
        ],
      },
      {
        id: "STEP-002",
        type: "end",
        label: "Approved",
        owner: "Operations",
        connections: [],
      },
      {
        id: "STEP-003",
        type: "end",
        label: "Rejected",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.steps[0].connections,
    [
      {
        targetStepId: "STEP-002",
        label: "Yes",
      },
      {
        targetStepId: "STEP-003",
        label: "",
      },
    ]
  );
});

// ========================================
// Invalid Process Model Tests
// ========================================

test("rejects responses with no usable process steps", () => {
  assert.throws(
    () =>
      normalizeProcessModelResponse({
        processName: "Invalid Process",
        actors: [],
        steps: [
          null,
          "invalid",
          42,
          [],
        ],
        warnings: [],
      }),
    {
      message:
        "The AI provider response did not contain any usable process steps.",
    }
  );
});

// ========================================
// Normalized Process Structure Validation
// ========================================

test("rejects duplicate process step IDs", () => {
  assert.throws(
    () =>
      normalizeProcessModelResponse({
        processName: "Duplicate Step Process",
        actors: ["Operations"],
        steps: [
          {
            id: "STEP-001",
            type: "start",
            label: "Begin",
            owner: "Operations",
            connections: [],
          },
          {
            id: "STEP-001",
            type: "end",
            label: "Complete",
            owner: "Operations",
            connections: [],
          },
        ],
        warnings: [],
      }),
    {
      message:
        "The AI provider returned duplicate process-step ID: STEP-001.",
    }
  );
});

test("rejects connections to unknown process step IDs", () => {
  assert.throws(
    () =>
      normalizeProcessModelResponse({
        processName: "Dangling Connection Process",
        actors: ["Operations"],
        steps: [
          {
            id: "STEP-001",
            type: "start",
            label: "Begin",
            owner: "Operations",
            connections: [
              {
                targetStepId: "STEP-999",
                label: "",
              },
            ],
          },
          {
            id: "STEP-002",
            type: "end",
            label: "Complete",
            owner: "Operations",
            connections: [],
          },
        ],
        warnings: [],
      }),
    {
      message:
        "The AI provider returned a connection from STEP-001 to unknown process-step ID: STEP-999.",
    }
  );
});

// ========================================
// Raw Provider Response Parsing Tests
// ========================================

test("parses a fenced JSON provider response", () => {
  const {
    processAiResponse,
  } = require("../src/utils/processResponseUtils");

  const normalizedModel = processAiResponse(`
\`\`\`json
{
  "processName": "Fenced Response Process",
  "actors": ["Operations"],
  "steps": [
    {
      "id": "STEP-001",
      "type": "start",
      "label": "Process started",
      "owner": "Operations",
      "connections": [
        {
          "targetStepId": "STEP-002",
          "label": ""
        }
      ]
    },
    {
      "id": "STEP-002",
      "type": "end",
      "label": "Process completed",
      "owner": "Operations",
      "connections": []
    }
  ],
  "warnings": []
}
\`\`\`
  `);

  assert.equal(
    normalizedModel.processName,
    "Fenced Response Process"
  );

  assert.deepEqual(
    normalizedModel.steps[0].connections,
    [
      {
        targetStepId: "STEP-002",
        label: "",
      },
    ]
  );
});

// ========================================
// Invalid Provider Response Parsing Tests
// ========================================

test("rejects malformed JSON provider responses", () => {
  const {
    processAiResponse,
  } = require("../src/utils/processResponseUtils");

  assert.throws(
    () =>
      processAiResponse(`
        {
          "processName": "Broken Response",
          "steps": [
        }
      `),
    {
      message:
        "The AI provider returned invalid JSON for the process model.",
    }
  );
});

// ========================================
// Actor Synchronization Tests
// ========================================

test("adds missing step owners to the normalized actor list", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Actor Synchronization",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Request received",
        owner: "Operations",
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
        label: "Manager review",
        owner: "Finance Manager",
        connections: [
          {
            targetStepId: "STEP-003",
            label: "",
          },
        ],
      },
      {
        id: "STEP-003",
        type: "end",
        label: "Review completed",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.actors,
    [
      "Operations",
      "Finance Manager",
    ]
  );
});

// ========================================
// Missing Owner Normalization Tests
// ========================================

test("assigns Unassigned when a process step owner is missing", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Missing Owner Process",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Request received",
        owner: "",
        connections: [
          {
            targetStepId: "STEP-002",
            label: "",
          },
        ],
      },
      {
        id: "STEP-002",
        type: "end",
        label: "Request completed",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.equal(
    normalizedModel.steps[0].owner,
    "Unassigned"
  );

  assert.deepEqual(
    normalizedModel.actors,
    [
      "Operations",
      "Unassigned",
    ]
  );
});

// ========================================
// Missing Step Label Normalization Tests
// ========================================

test("creates a review placeholder when a process step label is missing", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Missing Label Process",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-002",
            label: "",
          },
        ],
      },
      {
        id: "STEP-002",
        type: "end",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.equal(
    normalizedModel.steps[0].label,
    "Review process step 1"
  );

  assert.equal(
    normalizedModel.steps[1].label,
    "Review process step 2"
  );
});

// ========================================
// Step Type Normalization Tests
// ========================================

test("normalizes missing and unsupported step types to process", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Step Type Normalization",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "",
        label: "First step",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-002",
            label: "",
          },
        ],
      },
      {
        id: "STEP-002",
        type: "approval_gate",
        label: "Second step",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-003",
            label: "",
          },
        ],
      },
      {
        id: "STEP-003",
        type: "END",
        label: "Process completed",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.equal(
    normalizedModel.steps[0].type,
    "process"
  );

  assert.equal(
    normalizedModel.steps[1].type,
    "process"
  );

  assert.equal(
    normalizedModel.steps[2].type,
    "end"
  );
});

// ========================================
// Fallback Step ID Tests
// ========================================

test("creates deterministic fallback IDs for missing process step IDs", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Fallback Step IDs",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "",
        type: "start",
        label: "Process started",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-002",
            label: "",
          },
        ],
      },
      {
        type: "process",
        label: "Review request",
        owner: "Operations",
        connections: [
          {
            targetStepId: "CUSTOM-END",
            label: "",
          },
        ],
      },
      {
        id: "CUSTOM-END",
        type: "end",
        label: "Process completed",
        owner: "Operations",
      },
    ],
    warnings: [],
  });

  assert.equal(
    normalizedModel.steps[0].id,
    "STEP-001"
  );

  assert.equal(
    normalizedModel.steps[1].id,
    "STEP-002"
  );

  assert.equal(
    normalizedModel.steps[2].id,
    "CUSTOM-END"
  );
});

// ========================================
// Warning Normalization Tests
// ========================================

test("normalizes string and structured provider warnings", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Warning Normalization",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "end",
        label: "Process completed",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [
      "Approval criteria are unclear.",
      {
        code: "MISSING_OWNER_RULE",
        message: "The escalation owner is not defined.",
      },
      {
        message: "The timeout duration is missing.",
      },
      null,
      {
        code: "INVALID_WARNING",
        message: "",
      },
    ],
  });

  assert.deepEqual(
    normalizedModel.warnings,
    [
      {
        code: "AI_WARNING_001",
        message: "Approval criteria are unclear.",
      },
      {
        code: "MISSING_OWNER_RULE",
        message: "The escalation owner is not defined.",
      },
      {
        code: "AI_WARNING_003",
        message: "The timeout duration is missing.",
      },
    ]
  );
});

// ========================================
// Process Name and Actor Cleanup Tests
// ========================================

test("normalizes process names and removes duplicate actors", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "  Invoice Approval  ",
    actors: [
      "Operations",
      " operations ",
      "Finance",
      "",
      null,
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Invoice received",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-002",
            label: "",
          },
        ],
      },
      {
        id: "STEP-002",
        type: "end",
        label: "Invoice completed",
        owner: "Finance",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.equal(
    normalizedModel.processName,
    "Invoice Approval"
  );

  assert.deepEqual(
    normalizedModel.actors,
    [
      "Operations",
      "Finance",
    ]
  );
});