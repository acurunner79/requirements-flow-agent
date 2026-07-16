const test = require("node:test");
const assert = require("node:assert/strict");

const {
  findUnreachableProcessStepIds,
  normalizeProcessModelResponse,
  findDisconnectedProcessSections,
  findUnexpectedDeadEndStepIds,
  findUnreachableEndStepIds,
  findCircularProcessStepGroups,
  findDecisionStepIdsWithInsufficientBranches,
  findDecisionBranchLabelIssues,
  findUnusedActors,
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
        type: "start",
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
        type: "start",
        label: "Process started",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-001",
            label: "",
          },
        ],
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
        type: "start",
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

test("rejects process models without a start step", () => {
  assert.throws(
    () =>
      normalizeProcessModelResponse({
        processName: "Missing Start Process",
        actors: ["Operations"],
        steps: [
          {
            id: "STEP-001",
            type: "process",
            label: "Review request",
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
            label: "Complete process",
            owner: "Operations",
            connections: [],
          },
        ],
        warnings: [],
      }),
    {
      message:
        "The AI provider response must contain one start process step.",
    }
  );
});

test("rejects process models with multiple start steps", () => {
  assert.throws(
    () =>
      normalizeProcessModelResponse({
        processName: "Multiple Start Process",
        actors: ["Operations"],
        steps: [
          {
            id: "STEP-001",
            type: "start",
            label: "First start",
            owner: "Operations",
            connections: [
              {
                targetStepId: "STEP-003",
                label: "",
              },
            ],
          },
          {
            id: "STEP-002",
            type: "start",
            label: "Second start",
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
            type: "end",
            label: "Complete process",
            owner: "Operations",
            connections: [],
          },
        ],
        warnings: [],
      }),
    {
      message:
        "The AI provider response must not contain multiple start process steps.",
    }
  );
});

test("rejects process models without an end step", () => {
  assert.throws(
    () =>
      normalizeProcessModelResponse({
        processName: "Missing End Process",
        actors: ["Operations"],
        steps: [
          {
            id: "STEP-001",
            type: "start",
            label: "Begin",
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
            label: "Continue processing",
            owner: "Operations",
            connections: [],
          },
        ],
        warnings: [],
      }),
    {
      message:
        "The AI provider response must contain at least one end process step.",
    }
  );
});

// ========================================
// Unreachable Process Step Detection Tests
// ========================================

/**
 * Confirms that process steps with no path from the single start step are
 * reported as unreachable.
 *
 * The detector returns IDs in their original process-model order so warning
 * generation and user-facing diagnostics remain deterministic.
 */
test("detects process steps that are unreachable from the start step", () => {
  const steps = [
    {
      id: "STEP-001",
      type: "start",
      label: "Begin",
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
      label: "Complete",
      owner: "Operations",
      connections: [],
    },
    {
      id: "STEP-003",
      type: "process",
      label: "Disconnected review",
      owner: "Operations",
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
      label: "Disconnected completion",
      owner: "Operations",
      connections: [],
    },
  ];

  assert.deepEqual(
    findUnreachableProcessStepIds(steps),
    [
      "STEP-003",
      "STEP-004",
    ]
  );
});

/**
 * Confirms that unreachable steps are preserved in the normalized model and
 * surfaced through a deterministic process-quality warning.
 *
 * Unreachable steps are review concerns rather than structural failures, so the
 * model should remain usable.
 */
test("adds a warning for unreachable process steps", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Disconnected Review Process",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Begin",
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
        label: "Complete",
        owner: "Operations",
        connections: [],
      },
      {
        id: "STEP-003",
        type: "process",
        label: "Disconnected review",
        owner: "Operations",
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
        label: "Disconnected completion",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [
      {
        code: "AI_WARNING_001",
        message: "Approval criteria are unclear.",
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
        code: "UNREACHABLE_PROCESS_STEPS",
        message:
          "The following process steps cannot be reached from the start step: STEP-003, STEP-004.",
      },
      {
        code: "DISCONNECTED_PROCESS_SECTION_001",
        message:
          "The following process steps form a disconnected workflow section: STEP-003, STEP-004.",
      },
      {
        code: "UNREACHABLE_END_STEPS",
        message:
          "The following end process steps cannot be reached from the start step: STEP-004.",
      },
    ]
  );
});

// ========================================
// Disconnected Workflow Section Detection Tests
// ========================================

/**
 * Confirms that separate workflow islands are detected when process
 * connections are evaluated in both directions.
 *
 * The section containing the start step is treated as the primary workflow.
 * Every additional connected group is returned in deterministic model order.
 */
test("detects disconnected workflow sections", () => {
  const steps = [
    {
      id: "STEP-001",
      type: "start",
      label: "Begin",
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
      label: "Complete",
      owner: "Operations",
      connections: [],
    },
    {
      id: "STEP-003",
      type: "process",
      label: "Disconnected review",
      owner: "Finance",
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
      label: "Disconnected completion",
      owner: "Finance",
      connections: [],
    },
    {
      id: "STEP-005",
      type: "process",
      label: "Standalone task",
      owner: "Legal",
      connections: [],
    },
  ];

  assert.deepEqual(
    findDisconnectedProcessSections(steps),
    [
      [
        "STEP-003",
        "STEP-004",
      ],
      [
        "STEP-005",
      ],
    ]
  );
});

/**
 * Confirms that disconnected workflow sections are preserved and surfaced as
 * deterministic process-quality warnings.
 *
 * Each disconnected section receives its own warning so reviewers can identify
 * separate workflow islands without rejecting the entire process model.
 */
test("adds warnings for disconnected workflow sections", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Disconnected Workflow Process",
    actors: [
      "Operations",
      "Finance",
      "Legal",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Begin",
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
        label: "Complete",
        owner: "Operations",
        connections: [],
      },
      {
        id: "STEP-003",
        type: "process",
        label: "Disconnected finance review",
        owner: "Finance",
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
        label: "Finance review complete",
        owner: "Finance",
        connections: [],
      },
      {
        id: "STEP-005",
        type: "process",
        label: "Standalone legal review",
        owner: "Legal",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.warnings,
    [
      {
        code: "UNREACHABLE_PROCESS_STEPS",
        message:
          "The following process steps cannot be reached from the start step: STEP-003, STEP-004, STEP-005.",
      },
      {
        code: "DISCONNECTED_PROCESS_SECTION_001",
        message:
          "The following process steps form a disconnected workflow section: STEP-003, STEP-004.",
      },
      {
        code: "DISCONNECTED_PROCESS_SECTION_002",
        message:
          "The following process steps form a disconnected workflow section: STEP-005.",
      },
      {
        code: "UNEXPECTED_PROCESS_DEAD_ENDS",
        message:
          "The following non-terminal process steps have no outgoing connections: STEP-005.",
      },
      {
        code: "UNREACHABLE_END_STEPS",
        message:
          "The following end process steps cannot be reached from the start step: STEP-004.",
      },
    ]
  );
});

// ========================================
// Circular Process Path Tests
// ========================================

/**
 * Confirms that groups of process steps participating in directed cycles are
 * detected without including steps that merely lead into or out of the cycle.
 *
 * Returned groups and their step IDs preserve process-model order.
 */
test("detects circular process paths", () => {
  const steps = [
    {
      id: "STEP-001",
      type: "start",
      label: "Begin",
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
      label: "Review request",
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
      type: "decision",
      label: "Changes required?",
      owner: "Operations",
      connections: [
        {
          targetStepId: "STEP-002",
          label: "Yes",
        },
        {
          targetStepId: "STEP-004",
          label: "No",
        },
      ],
    },
    {
      id: "STEP-004",
      type: "end",
      label: "Complete",
      owner: "Operations",
      connections: [],
    },
    {
      id: "STEP-005",
      type: "process",
      label: "Unrelated review",
      owner: "Finance",
      connections: [
        {
          targetStepId: "STEP-006",
          label: "",
        },
      ],
    },
    {
      id: "STEP-006",
      type: "end",
      label: "Finance complete",
      owner: "Finance",
      connections: [],
    },
  ];

  assert.deepEqual(
    findCircularProcessStepGroups(steps),
    [
      [
        "STEP-002",
        "STEP-003",
      ],
    ]
  );
});

// ========================================
// Decision Branch Count Tests
// ========================================

/**
 * Confirms that decision steps with fewer than two outgoing branches are
 * detected while properly branched decisions and non-decision steps are
 * excluded.
 *
 * Returned IDs preserve the original process-model order.
 */
test("detects decision steps with insufficient branches", () => {
  const steps = [
    {
      id: "STEP-001",
      type: "start",
      label: "Begin",
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
      type: "decision",
      label: "Request complete?",
      owner: "Operations",
      connections: [
        {
          targetStepId: "STEP-003",
          label: "Yes",
        },
      ],
    },
    {
      id: "STEP-003",
      type: "decision",
      label: "Approval required?",
      owner: "Operations",
      connections: [
        {
          targetStepId: "STEP-004",
          label: "Yes",
        },
        {
          targetStepId: "STEP-006",
          label: "No",
        },
      ],
    },
    {
      id: "STEP-004",
      type: "process",
      label: "Review approval",
      owner: "Manager",
      connections: [
        {
          targetStepId: "STEP-006",
          label: "",
        },
      ],
    },
    {
      id: "STEP-005",
      type: "decision",
      label: "Exception found?",
      owner: "Operations",
      connections: [],
    },
    {
      id: "STEP-006",
      type: "end",
      label: "Complete",
      owner: "Operations",
      connections: [],
    },
  ];

  assert.deepEqual(
    findDecisionStepIdsWithInsufficientBranches(steps),
    [
      "STEP-002",
      "STEP-005",
    ]
  );
});

/**
 * Confirms that decision steps with fewer than two branches remain in the
 * normalized model and are surfaced through a process-quality warning.
 */
test("adds a warning for decision steps with insufficient branches", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Approval Workflow",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Begin",
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
        type: "decision",
        label: "Request approved?",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-003",
            label: "Yes",
          },
        ],
      },
      {
        id: "STEP-003",
        type: "end",
        label: "Complete",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.warnings,
    [
      {
        code: "INSUFFICIENT_DECISION_BRANCHES",
        message:
          "The following decision process steps have fewer than two outgoing branches: STEP-002.",
      },
    ]
  );
});

// ========================================
// Decision Branch Label Tests
// ========================================

/**
 * Confirms that decision branches with duplicate or missing labels are
 * identified while valid branch labels are excluded.
 *
 * Duplicate comparisons ignore capitalization and surrounding whitespace.
 */
test("detects duplicate and ambiguous decision branch labels", () => {
  const steps = [
    {
      id: "STEP-001",
      type: "start",
      label: "Begin",
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
      type: "decision",
      label: "Request approved?",
      owner: "Operations",
      connections: [
        {
          targetStepId: "STEP-003",
          label: "Yes",
        },
        {
          targetStepId: "STEP-004",
          label: " yes ",
        },
        {
          targetStepId: "STEP-005",
          label: "",
        },
      ],
    },
    {
      id: "STEP-003",
      type: "decision",
      label: "Additional review required?",
      owner: "Operations",
      connections: [
        {
          targetStepId: "STEP-004",
          label: "Required",
        },
        {
          targetStepId: "STEP-005",
          label: "Not required",
        },
      ],
    },
    {
      id: "STEP-004",
      type: "end",
      label: "Approved",
      owner: "Operations",
      connections: [],
    },
    {
      id: "STEP-005",
      type: "end",
      label: "Rejected",
      owner: "Operations",
      connections: [],
    },
  ];

  assert.deepEqual(
    findDecisionBranchLabelIssues(steps),
    [
      {
        stepId: "STEP-002",
        duplicateLabels: [
          "Yes",
        ],
        unlabeledBranchCount: 1,
      },
    ]
  );
});

/**
 * Confirms that duplicate and unlabeled decision branches are preserved and
 * surfaced through deterministic process-quality warnings.
 */
test("adds warnings for duplicate and ambiguous decision branch labels", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Approval Workflow",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Begin",
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
        type: "decision",
        label: "Request approved?",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-003",
            label: "Yes",
          },
          {
            targetStepId: "STEP-004",
            label: " yes ",
          },
          {
            targetStepId: "STEP-005",
            label: "",
          },
        ],
      },
      {
        id: "STEP-003",
        type: "end",
        label: "Approved",
        owner: "Operations",
        connections: [],
      },
      {
        id: "STEP-004",
        type: "end",
        label: "Escalated",
        owner: "Operations",
        connections: [],
      },
      {
        id: "STEP-005",
        type: "end",
        label: "Rejected",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.warnings,
    [
      {
        code: "DUPLICATE_DECISION_BRANCH_LABELS_STEP-002",
        message:
          "Decision step STEP-002 contains duplicate branch labels: Yes.",
      },
      {
        code: "UNLABELED_DECISION_BRANCHES_STEP-002",
        message:
          "Decision step STEP-002 contains 1 unlabeled outgoing branch.",
      },
    ]
  );
});

// ========================================
// Unused Actor Tests
// ========================================

/**
 * Confirms that actors not assigned as the owner of any process step are
 * detected while actors currently participating in the workflow are excluded.
 *
 * Returned actor names preserve the original actor-list order.
 */
test("detects unused process actors", () => {
  const actors = [
    "Operations",
    "Finance",
    "Legal",
  ];

  const steps = [
    {
      id: "STEP-001",
      type: "start",
      label: "Begin",
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
      label: "Review request",
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
      type: "end",
      label: "Complete",
      owner: "Operations",
      connections: [],
    },
  ];

  assert.deepEqual(
    findUnusedActors(
      actors,
      steps
    ),
    [
      "Finance",
      "Legal",
    ]
  );
});

/**
 * Confirms that actors listed in the process model but not assigned to any step
 * are preserved and surfaced through a process-quality warning.
 */
test("adds a warning for unused process actors", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Simple Review Workflow",
    actors: [
      "Operations",
      "Finance",
      "Legal",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Begin",
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
        label: "Review request",
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
        type: "end",
        label: "Complete",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.warnings,
    [
      {
        code: "UNUSED_PROCESS_ACTORS",
        message:
          "The following process actors are not assigned to any process step: Finance, Legal.",
      },
    ]
  );
});

// ========================================
// Process Quality Warning Behavior Tests
// ========================================

/**
 * Confirms that process-quality problems are surfaced as warnings instead of
 * causing an otherwise structurally valid process model to be rejected.
 */
test("preserves imperfect process models and returns quality warnings", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Imperfect Review Workflow",
    actors: [
      "Operations",
      "Finance",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Begin",
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
        type: "decision",
        label: "Request approved?",
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
        type: "end",
        label: "Complete",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.equal(
    normalizedModel.steps.length,
    3
  );

  assert.deepEqual(
    normalizedModel.warnings,
    [
      {
        code: "INSUFFICIENT_DECISION_BRANCHES",
        message:
          "The following decision process steps have fewer than two outgoing branches: STEP-002.",
      },
      {
        code: "UNLABELED_DECISION_BRANCHES_STEP-002",
        message:
          "Decision step STEP-002 contains 1 unlabeled outgoing branch.",
      },
      {
        code: "UNUSED_PROCESS_ACTORS",
        message:
          "The following process actors are not assigned to any process step: Finance.",
      },
    ]
  );
});

// ========================================
// Unexpected Dead-End Detection Tests
// ========================================

/**
 * Confirms that non-terminal steps with no outgoing connections are reported as
 * unexpected dead ends.
 *
 * End steps are valid terminal outcomes and must not be included.
 */
test("detects unexpected process dead ends", () => {
  const steps = [
    {
      id: "STEP-001",
      type: "start",
      label: "Begin",
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
      label: "Review request",
      owner: "Operations",
      connections: [],
    },
    {
      id: "STEP-003",
      type: "decision",
      label: "Is approval required?",
      owner: "Operations",
      connections: [],
    },
    {
      id: "STEP-004",
      type: "end",
      label: "Complete",
      owner: "Operations",
      connections: [],
    },
  ];

  assert.deepEqual(
    findUnexpectedDeadEndStepIds(steps),
    [
      "STEP-002",
      "STEP-003",
    ]
  );
});

/**
 * Confirms that unexpected dead ends remain in the normalized process model and
 * are surfaced through a deterministic process-quality warning.
 */
test("adds a warning for unexpected process dead ends", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Incomplete Review Process",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Begin",
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
        label: "Review request",
        owner: "Operations",
        connections: [],
      },
      {
        id: "STEP-003",
        type: "end",
        label: "Complete",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.warnings,
    [
      {
        code: "UNREACHABLE_PROCESS_STEPS",
        message:
          "The following process steps cannot be reached from the start step: STEP-003.",
      },
      {
        code: "DISCONNECTED_PROCESS_SECTION_001",
        message:
          "The following process steps form a disconnected workflow section: STEP-003.",
      },
      {
        code: "UNEXPECTED_PROCESS_DEAD_ENDS",
        message:
          "The following non-terminal process steps have no outgoing connections: STEP-002.",
      },
      {
        code: "UNREACHABLE_END_STEPS",
        message:
          "The following end process steps cannot be reached from the start step: STEP-003.",
      },
    ]
  );
});

/**
 * Confirms that circular process paths are preserved and surfaced as
 * process-quality warnings for human review.
 */
test("adds warnings for circular process paths", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Revision Workflow",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Begin",
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
        label: "Review request",
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
        type: "decision",
        label: "Changes required?",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-002",
            label: "Yes",
          },
          {
            targetStepId: "STEP-004",
            label: "No",
          },
        ],
      },
      {
        id: "STEP-004",
        type: "end",
        label: "Complete",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.warnings,
    [
      {
        code: "CIRCULAR_PROCESS_PATH_001",
        message:
          "The following process steps form a circular path that should be reviewed: STEP-002, STEP-003.",
      },
    ]
  );
});

// ========================================
// End-Step Reachability Tests
// ========================================

/**
 * Confirms that terminal outcomes with no path from the start step are reported.
 *
 * Reachable end steps must not be included, and returned IDs preserve the
 * original process-model order.
 */
test("detects end steps that are unreachable from the start step", () => {
  const steps = [
    {
      id: "STEP-001",
      type: "start",
      label: "Begin",
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
      label: "Reachable completion",
      owner: "Operations",
      connections: [],
    },
    {
      id: "STEP-003",
      type: "process",
      label: "Disconnected review",
      owner: "Finance",
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
      label: "Unreachable completion",
      owner: "Finance",
      connections: [],
    },
    {
      id: "STEP-005",
      type: "end",
      label: "Standalone completion",
      owner: "Legal",
      connections: [],
    },
  ];

  assert.deepEqual(
    findUnreachableEndStepIds(steps),
    [
      "STEP-004",
      "STEP-005",
    ]
  );
});

/**
 * Confirms that unreachable terminal outcomes are preserved and surfaced
 * through a dedicated process-quality warning.
 */
test("adds a warning for unreachable end steps", () => {
  const normalizedModel = normalizeProcessModelResponse({
    processName: "Multiple Outcome Process",
    actors: [
      "Operations",
      "Finance",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Begin",
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
        label: "Reachable completion",
        owner: "Operations",
        connections: [],
      },
      {
        id: "STEP-003",
        type: "process",
        label: "Disconnected review",
        owner: "Finance",
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
        label: "Unreachable completion",
        owner: "Finance",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.deepEqual(
    normalizedModel.warnings,
    [
      {
        code: "UNREACHABLE_PROCESS_STEPS",
        message:
          "The following process steps cannot be reached from the start step: STEP-003, STEP-004.",
      },
      {
        code: "DISCONNECTED_PROCESS_SECTION_001",
        message:
          "The following process steps form a disconnected workflow section: STEP-003, STEP-004.",
      },
      {
        code: "UNREACHABLE_END_STEPS",
        message:
          "The following end process steps cannot be reached from the start step: STEP-004.",
      },
    ]
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
        id: "STEP-002",
        type: "",
        label: "First step",
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
        type: "approval_gate",
        label: "Second step",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-004",
            label: "",
          },
        ],
      },
      {
        id: "STEP-004",
        type: "END",
        label: "Process completed",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  assert.equal(
    normalizedModel.steps[1].type,
    "process"
  );

  assert.equal(
    normalizedModel.steps[2].type,
    "process"
  );

  assert.equal(
    normalizedModel.steps[3].type,
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
        id: "STEP-002",
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