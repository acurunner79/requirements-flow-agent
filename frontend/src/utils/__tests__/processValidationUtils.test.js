import { describe, expect, test } from "vitest";

import {
  VALIDATION_SEVERITIES,
  createStepIdSet,
  getStepConnections,
  hasUsableText,
  validateProcessModel,
} from "../processValidationUtils";

// ========================================
// Valid Process Model Tests
// ========================================

describe("validateProcessModel", () => {
  test("returns no issues for a complete valid process", () => {
    const issues = validateProcessModel({
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
          label: "Is manager approval required?",
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

    expect(issues).toEqual([]);
  });

  test("returns one blocking issue for an invalid process model", () => {
    const issues = validateProcessModel(null);

    expect(issues).toEqual([
      {
        code: "INVALID_PROCESS_MODEL",
        severity: VALIDATION_SEVERITIES.ERROR,
        message: "A valid process model is required.",
        stepId: null,
      },
    ]);
  });
});

// ========================================
// Decision Path Validation Tests
// ========================================

test("reports incomplete and unlabeled decision branches", () => {
  const issues = validateProcessModel({
    processName: "Approval Review",
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
        type: "decision",
        label: "Is approval required?",
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
        label: "Request completed",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "MISSING_DECISION_CONNECTION_LABEL",
        severity: VALIDATION_SEVERITIES.WARNING,
        stepId: "STEP-002",
      }),
      expect.objectContaining({
        code: "INCOMPLETE_DECISION_PATHS",
        severity: VALIDATION_SEVERITIES.WARNING,
        stepId: "STEP-002",
      }),
    ])
  );
});

// ========================================
// Connection Target Validation Tests
// ========================================

test("reports missing and invalid connection targets", () => {
  const issues = validateProcessModel({
    processName: "Connection Validation",
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
            targetStepId: "",
            label: "",
          },
          {
            targetStepId: "STEP-999",
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

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "MISSING_CONNECTION_TARGET",
        severity: VALIDATION_SEVERITIES.ERROR,
        stepId: "STEP-001",
      }),
      expect.objectContaining({
        code: "INVALID_CONNECTION_TARGET",
        severity: VALIDATION_SEVERITIES.ERROR,
        stepId: "STEP-001",
      }),
    ])
  );
});

// ========================================
// Duplicate and Self-Reference Validation Tests
// ========================================

test("reports duplicate and self-referencing connections", () => {
  const issues = validateProcessModel({
    processName: "Connection Integrity",
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
            targetStepId: "STEP-001",
            label: "Retry",
          },
          {
            targetStepId: "STEP-002",
            label: "",
          },
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

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "SELF_REFERENCING_CONNECTION",
        severity: VALIDATION_SEVERITIES.WARNING,
        stepId: "STEP-001",
      }),
      expect.objectContaining({
        code: "DUPLICATE_CONNECTION",
        severity: VALIDATION_SEVERITIES.WARNING,
        stepId: "STEP-001",
      }),
    ])
  );
});

// ========================================
// Process Path Completion Validation Tests
// ========================================

test("reports outgoing paths on end steps and missing paths on non-end steps", () => {
  const issues = validateProcessModel({
    processName: "Path Completion Validation",
    actors: [
      "Operations",
    ],
    steps: [
      {
        id: "STEP-001",
        type: "start",
        label: "Request received",
        owner: "Operations",
        connections: [],
      },
      {
        id: "STEP-002",
        type: "end",
        label: "Request completed",
        owner: "Operations",
        connections: [
          {
            targetStepId: "STEP-001",
            label: "",
          },
        ],
      },
    ],
    warnings: [],
  });

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "MISSING_OUTGOING_PATH",
        severity: VALIDATION_SEVERITIES.WARNING,
        stepId: "STEP-001",
      }),
      expect.objectContaining({
        code: "END_STEP_HAS_OUTGOING_PATH",
        severity: VALIDATION_SEVERITIES.ERROR,
        stepId: "STEP-002",
      }),
    ])
  );
});

// ========================================
// Start and End Step Validation Tests
// ========================================

test("reports missing start and end steps", () => {
  const issues = validateProcessModel({
    processName: "Boundary Step Validation",
    actors: [
      "Operations",
    ],
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
        type: "process",
        label: "Complete review",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "MISSING_START_STEP",
        severity: VALIDATION_SEVERITIES.ERROR,
        stepId: null,
      }),
      expect.objectContaining({
        code: "MISSING_END_STEP",
        severity: VALIDATION_SEVERITIES.ERROR,
        stepId: null,
      }),
    ])
  );
});

// ========================================
// Multiple Start Step Validation Tests
// ========================================

test("reports multiple start steps as a warning", () => {
  const issues = validateProcessModel({
    processName: "Multiple Start Validation",
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
            targetStepId: "STEP-003",
            label: "",
          },
        ],
      },
      {
        id: "STEP-002",
        type: "start",
        label: "Manual request received",
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
        label: "Request completed",
        owner: "Operations",
        connections: [],
      },
    ],
    warnings: [],
  });

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "MULTIPLE_START_STEPS",
        severity: VALIDATION_SEVERITIES.WARNING,
        stepId: null,
      }),
    ])
  );
});

// ========================================
// Missing Core Process Data Tests
// ========================================

test("reports missing process name, actors, and steps", () => {
  const issues = validateProcessModel({
    processName: "   ",
    actors: [],
    steps: [],
    warnings: [],
  });

  expect(issues).toEqual([
    {
      code: "MISSING_PROCESS_NAME",
      severity: VALIDATION_SEVERITIES.ERROR,
      message: "Enter a process name before exporting.",
      stepId: null,
    },
    {
      code: "MISSING_ACTORS",
      severity: VALIDATION_SEVERITIES.ERROR,
      message: "Add at least one actor to the process.",
      stepId: null,
    },
    {
      code: "MISSING_PROCESS_STEPS",
      severity: VALIDATION_SEVERITIES.ERROR,
      message: "Add at least one process step.",
      stepId: null,
    },
  ]);
});

// ========================================
// Step Metadata Validation Tests
// ========================================

test("reports missing step metadata, invalid types, and duplicate IDs", () => {
  const issues = validateProcessModel({
    processName: "Step Metadata Validation",
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
        type: "unsupported",
        label: "",
        owner: "",
        connections: [],
      },
      {
        id: "STEP-002",
        type: "end",
        label: "Request completed",
        owner: "Unassigned",
        connections: [],
      },
    ],
    warnings: [],
  });

  expect(issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "MISSING_STEP_LABEL",
        severity: VALIDATION_SEVERITIES.ERROR,
        stepId: "STEP-002",
      }),
      expect.objectContaining({
        code: "MISSING_STEP_OWNER",
        severity: VALIDATION_SEVERITIES.ERROR,
        stepId: "STEP-002",
      }),
      expect.objectContaining({
        code: "INVALID_STEP_TYPE",
        severity: VALIDATION_SEVERITIES.ERROR,
        stepId: "STEP-002",
      }),
      expect.objectContaining({
        code: "DUPLICATE_STEP_ID",
        severity: VALIDATION_SEVERITIES.ERROR,
        stepId: "STEP-002",
      }),
      expect.objectContaining({
        code: "UNASSIGNED_STEP_OWNER",
        severity: VALIDATION_SEVERITIES.WARNING,
        stepId: "STEP-002",
      }),
    ])
  );
});

// ========================================
// Process Validation Helper Tests
// ========================================

describe("process validation helpers", () => {
  test("creates a trimmed set of usable process step IDs", () => {
    const stepIds = createStepIdSet([
      {
        id: " STEP-001 ",
      },
      {
        id: "STEP-002",
      },
      {
        id: "",
      },
      {
        id: null,
      },
      {
        id: "STEP-001",
      },
    ]);

    expect(stepIds).toEqual(
      new Set([
        "STEP-001",
        "STEP-002",
      ])
    );
  });

  test("returns rich connections or an empty defensive fallback", () => {
    const connections = [
      {
        targetStepId: "STEP-002",
        label: "Yes",
      },
    ];

    expect(
      getStepConnections({
        connections,
      })
    ).toBe(connections);

    expect(
      getStepConnections({
        connections: null,
      })
    ).toEqual([]);

    expect(
      getStepConnections({})
    ).toEqual([]);
  });

  test("identifies usable text consistently", () => {
    expect(hasUsableText("STEP-001")).toBe(true);
    expect(hasUsableText("  Operations  ")).toBe(true);

    expect(hasUsableText("")).toBe(false);
    expect(hasUsableText("   ")).toBe(false);
    expect(hasUsableText(null)).toBe(false);
    expect(hasUsableText(100)).toBe(false);
  });
});