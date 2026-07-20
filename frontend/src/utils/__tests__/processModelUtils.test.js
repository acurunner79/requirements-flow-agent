import { describe, expect, test } from "vitest";

import {
  addProcessActor,
  createConnectionUpdates,
  hasUsableText,
  normalizeProcessConnections,
  removeProcessActor,
  reorderProcessSteps,
  updateProcessActor,
  updateProcessName,
  updateProcessStep,
  updateProcessStepConnections,
} from "../processModelUtils";

// ========================================
// Process Connection Normalization Tests
// ========================================

describe("normalizeProcessConnections", () => {
  test("trims, filters, and deduplicates rich connections", () => {
    const normalizedConnections = normalizeProcessConnections([
      {
        targetStepId: " STEP-002 ",
        label: " Yes ",
      },
      {
        targetStepId: "STEP-002",
        label: "Yes",
      },
      {
        targetStepId: "STEP-002",
        label: "No",
      },
      {
        targetStepId: "",
        label: "Invalid",
      },
      {
        label: "Missing target",
      },
      null,
      {
        targetStepId: "STEP-003",
        label: "",
      },
    ]);

    expect(normalizedConnections).toEqual([
      {
        targetStepId: "STEP-002",
        label: "Yes",
      },
      {
        targetStepId: "STEP-002",
        label: "No",
      },
      {
        targetStepId: "STEP-003",
        label: "",
      },
    ]);
  });

  test("throws when the supplied connection value is not an array", () => {
    expect(() =>
      normalizeProcessConnections(null)
    ).toThrow(
      "A valid connection array is required."
    );
  });
});

// ========================================
// Process Step Reordering Tests
// ========================================

describe("reorderProcessSteps", () => {
  /**
   * Confirms that moving a process step creates a new process model and steps
   * array while preserving the original step objects and source model.
   */
  test("moves a process step to a new position immutably", () => {
    const originalModel = {
      processName: "Request Review",
      actors: [
        "Requester",
        "Approver",
      ],
      steps: [
        {
          id: "STEP-001",
          type: "start",
          label: "Submit request",
          owner: "Requester",
          connections: [],
        },
        {
          id: "STEP-002",
          type: "process",
          label: "Review request",
          owner: "Approver",
          connections: [],
        },
        {
          id: "STEP-003",
          type: "end",
          label: "Complete request",
          owner: "Approver",
          connections: [],
        },
      ],
      warnings: [],
    };

    const updatedModel = reorderProcessSteps(
      originalModel,
      "STEP-003",
      "STEP-001"
    );

    expect(updatedModel).not.toBe(originalModel);
    expect(updatedModel.steps).not.toBe(
      originalModel.steps
    );

    expect(
      updatedModel.steps.map((step) => step.id)
    ).toEqual([
      "STEP-003",
      "STEP-001",
      "STEP-002",
    ]);

    /**
     * Reordering changes only array position. The individual step objects do
     * not require cloning because their stored data remains unchanged.
     */
    expect(updatedModel.steps[0]).toBe(
      originalModel.steps[2]
    );

    expect(
      originalModel.steps.map((step) => step.id)
    ).toEqual([
      "STEP-001",
      "STEP-002",
      "STEP-003",
    ]);
  });
});

// ========================================
// Process Step Connection Update Tests
// ========================================

describe("updateProcessStepConnections", () => {
  test("updates one step immutably with normalized connections", () => {
    const originalModel = {
      processName: "Refund Review",
      actors: [
        "Customer Service",
        "Manager",
      ],
      steps: [
        {
          id: "STEP-001",
          type: "decision",
          label: "Is approval required?",
          owner: "Customer Service",
          connections: [
            {
              targetStepId: "STEP-002",
              label: "Yes",
            },
          ],
        },
        {
          id: "STEP-002",
          type: "end",
          label: "Review completed",
          owner: "Manager",
          connections: [],
        },
      ],
      warnings: [],
    };

    const updatedModel = updateProcessStepConnections(
      originalModel,
      "STEP-001",
      [
        {
          targetStepId: " STEP-002 ",
          label: " Approved ",
        },
      ]
    );

    expect(updatedModel).not.toBe(originalModel);
    expect(updatedModel.steps).not.toBe(
      originalModel.steps
    );

    expect(updatedModel.steps[0]).not.toBe(
      originalModel.steps[0]
    );

    expect(updatedModel.steps[1]).toBe(
      originalModel.steps[1]
    );

    expect(updatedModel.steps[0].connections).toEqual([
      {
        targetStepId: "STEP-002",
        label: "Approved",
      },
    ]);

    expect(originalModel.steps[0].connections).toEqual([
      {
        targetStepId: "STEP-002",
        label: "Yes",
      },
    ]);

    expect(
      Object.prototype.hasOwnProperty.call(
        updatedModel.steps[0],
        "nextStepIds"
      )
    ).toBe(false);
  });

  test("throws when connections is not an array", () => {
    const processModel = {
      processName: "Invalid Update",
      actors: [],
      steps: [],
      warnings: [],
    };

    expect(() =>
      updateProcessStepConnections(
        processModel,
        "STEP-001",
        null
      )
    ).toThrow(
      "A valid connection array is required."
    );
  });
});

// ========================================
// Generic Process Step Update Tests
// ========================================

describe("updateProcessStep", () => {
  test("updates step metadata immutably", () => {
    const originalModel = {
      processName: "Refund Review",
      actors: [
        "Customer Service",
      ],
      steps: [
        {
          id: "STEP-001",
          type: "process",
          label: "Review request",
          owner: "Customer Service",
          connections: [],
        },
      ],
      warnings: [],
    };

    const updatedModel = updateProcessStep(
      originalModel,
      "STEP-001",
      {
        label: "Review refund request",
        owner: "Refund Team",
      }
    );

    expect(updatedModel).not.toBe(originalModel);
    expect(updatedModel.steps).not.toBe(
      originalModel.steps
    );

    expect(updatedModel.steps[0]).toEqual({
      id: "STEP-001",
      type: "process",
      label: "Review refund request",
      owner: "Refund Team",
      connections: [],
    });

    expect(originalModel.steps[0].label).toBe(
      "Review request"
    );
  });

  test("normalizes connections supplied through a generic step update", () => {
    const originalModel = {
      processName: "Connection Update",
      actors: [
        "Operations",
      ],
      steps: [
        {
          id: "STEP-001",
          type: "decision",
          label: "Choose route",
          owner: "Operations",
          connections: [],
        },
      ],
      warnings: [],
    };

    const updatedModel = updateProcessStep(
      originalModel,
      "STEP-001",
      {
        connections: [
          {
            targetStepId: " STEP-002 ",
            label: " Yes ",
          },
          {
            targetStepId: "STEP-002",
            label: "Yes",
          },
        ],
      }
    );

    expect(
      updatedModel.steps[0].connections
    ).toEqual([
      {
        targetStepId: "STEP-002",
        label: "Yes",
      },
    ]);

    expect(
      Object.prototype.hasOwnProperty.call(
        updatedModel.steps[0],
        "nextStepIds"
      )
    ).toBe(false);
  });

  test("throws when the target step ID is invalid", () => {
    const processModel = {
      processName: "Invalid Step Update",
      actors: [],
      steps: [],
      warnings: [],
    };

    expect(() =>
      updateProcessStep(
        processModel,
        "",
        {
          label: "Updated",
        }
      )
    ).toThrow(
      "A valid process step ID is required."
    );
  });
});

// ========================================
// Process Name Update Tests
// ========================================

describe("updateProcessName", () => {
  test("trims and updates the process name immutably", () => {
    const originalModel = {
      processName: "Old Process Name",
      actors: [],
      steps: [],
      warnings: [],
    };

    const updatedModel = updateProcessName(
      originalModel,
      "  Updated Process Name  "
    );

    expect(updatedModel).not.toBe(originalModel);

    expect(updatedModel.processName).toBe(
      "Updated Process Name"
    );

    expect(originalModel.processName).toBe(
      "Old Process Name"
    );
  });

  test("throws when the process name is empty", () => {
    const processModel = {
      processName: "Existing Process",
      actors: [],
      steps: [],
      warnings: [],
    };

    expect(() =>
      updateProcessName(
        processModel,
        "   "
      )
    ).toThrow(
      "A valid process name is required."
    );
  });

  test("throws when the process model is invalid", () => {
    expect(() =>
      updateProcessName(
        null,
        "Updated Process"
      )
    ).toThrow(
      "A valid process model is required."
    );
  });
});

// ========================================
// Process Actor Update Tests
// ========================================

describe("process actor utilities", () => {
  test("adds a trimmed actor immutably", () => {
    const originalModel = {
      processName: "Actor Test",
      actors: [
        "Operations",
      ],
      steps: [],
      warnings: [],
    };

    const updatedModel = addProcessActor(
      originalModel,
      "  Finance  "
    );

    expect(updatedModel).not.toBe(originalModel);

    expect(updatedModel.actors).toEqual([
      "Operations",
      "Finance",
    ]);

    expect(originalModel.actors).toEqual([
      "Operations",
    ]);
  });

  test("renames an actor and updates matching step owners", () => {
    const originalModel = {
      processName: "Actor Rename",
      actors: [
        "Operations",
        "Finance",
      ],
      steps: [
        {
          id: "STEP-001",
          type: "process",
          label: "Review request",
          owner: "Operations",
          connections: [],
        },
        {
          id: "STEP-002",
          type: "end",
          label: "Complete request",
          owner: "Finance",
          connections: [],
        },
      ],
      warnings: [],
    };

    const updatedModel = updateProcessActor(
      originalModel,
      "Operations",
      "Customer Operations"
    );

    expect(updatedModel.actors).toEqual([
      "Customer Operations",
      "Finance",
    ]);

    expect(updatedModel.steps[0].owner).toBe(
      "Customer Operations"
    );

    expect(updatedModel.steps[1].owner).toBe(
      "Finance"
    );

    expect(originalModel.steps[0].owner).toBe(
      "Operations"
    );
  });

  test("removes an actor and marks owned steps as Unassigned", () => {
    const originalModel = {
      processName: "Actor Removal",
      actors: [
        "Operations",
        "Finance",
      ],
      steps: [
        {
          id: "STEP-001",
          type: "process",
          label: "Review request",
          owner: "Operations",
          connections: [],
        },
        {
          id: "STEP-002",
          type: "end",
          label: "Complete request",
          owner: "Finance",
          connections: [],
        },
      ],
      warnings: [],
    };

    const updatedModel = removeProcessActor(
      originalModel,
      "Operations"
    );

    expect(updatedModel.actors).toEqual([
      "Finance",
    ]);

    expect(updatedModel.steps[0].owner).toBe(
      "Unassigned"
    );

    expect(updatedModel.steps[1].owner).toBe(
      "Finance"
    );

    expect(originalModel.actors).toEqual([
      "Operations",
      "Finance",
    ]);
  });
});

// ========================================
// Process Actor Validation Tests
// ========================================

describe("process actor utility validation", () => {
  const processModel = {
    processName: "Actor Validation",
    actors: [
      "Operations",
    ],
    steps: [],
    warnings: [],
  };

  test("rejects an empty actor name when adding an actor", () => {
    expect(() =>
      addProcessActor(
        processModel,
        "   "
      )
    ).toThrow(
      "A valid actor name is required."
    );
  });

  test("rejects invalid actor names when renaming an actor", () => {
    expect(() =>
      updateProcessActor(
        processModel,
        "",
        "Finance"
      )
    ).toThrow(
      "Valid current and updated actor names are required."
    );

    expect(() =>
      updateProcessActor(
        processModel,
        "Operations",
        "   "
      )
    ).toThrow(
      "Valid current and updated actor names are required."
    );
  });

  test("rejects an empty actor name when removing an actor", () => {
    expect(() =>
      removeProcessActor(
        processModel,
        ""
      )
    ).toThrow(
      "A valid actor name is required."
    );
  });
});

// ========================================
// Shared Process Model Helper Tests
// ========================================

describe("shared process model helpers", () => {
  test("identifies usable trimmed text values", () => {
    expect(hasUsableText("Operations")).toBe(true);
    expect(hasUsableText("  Finance  ")).toBe(true);

    expect(hasUsableText("")).toBe(false);
    expect(hasUsableText("   ")).toBe(false);
    expect(hasUsableText(null)).toBe(false);
    expect(hasUsableText(42)).toBe(false);
  });

  test("creates normalized rich connection updates only", () => {
    const updates = createConnectionUpdates([
      {
        targetStepId: " STEP-002 ",
        label: " Approved ",
      },
      {
        targetStepId: "STEP-002",
        label: "Approved",
      },
    ]);

    expect(updates).toEqual({
      connections: [
        {
          targetStepId: "STEP-002",
          label: "Approved",
        },
      ],
    });

    expect(
      Object.prototype.hasOwnProperty.call(
        updates,
        "nextStepIds"
      )
    ).toBe(false);
  });
});