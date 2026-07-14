import { describe, expect, test } from "vitest";

import {
  createRowsForProcessStep,
  createVisioProcessRows,
  getStepConnections,
  getVisioShapeType,
} from "../visioExportUtils";

// ========================================
// Visio Shape Mapping Tests
// ========================================

describe("getVisioShapeType", () => {
  test("maps supported process types to Visio shape labels", () => {
    expect(getVisioShapeType("start")).toBe("Start/End");
    expect(getVisioShapeType("process")).toBe("Process");
    expect(getVisioShapeType("decision")).toBe("Decision");
    expect(getVisioShapeType("end")).toBe("Start/End");
  });

  test("normalizes case and whitespace", () => {
    expect(getVisioShapeType("  DECISION  ")).toBe("Decision");
    expect(getVisioShapeType(" End ")).toBe("Start/End");
  });

  test("falls back to Process for unsupported values", () => {
    expect(getVisioShapeType("approval_gate")).toBe("Process");
    expect(getVisioShapeType(null)).toBe("Process");
    expect(getVisioShapeType(42)).toBe("Process");
  });
});

// ========================================
// Visio Connection Helper Tests
// ========================================

describe("getStepConnections", () => {
  test("returns the authoritative rich connection collection", () => {
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
  });

  test("returns an empty array for incomplete connection data", () => {
    expect(
      getStepConnections({
        connections: null,
      })
    ).toEqual([]);

    expect(getStepConnections({})).toEqual([]);
  });
});

// ========================================
// Single-Step Visio Row Tests
// ========================================

describe("createRowsForProcessStep", () => {
  test("creates one row per rich outgoing connection", () => {
    const rows = createRowsForProcessStep({
      id: "STEP-002",
      type: "decision",
      label: "Is approval required?",
      owner: "Operations",
      connections: [
        {
          targetStepId: " STEP-003 ",
          label: " Yes ",
        },
        {
          targetStepId: "STEP-004",
          label: "No",
        },
      ],
    });

    expect(rows).toEqual([
      {
        processStepId: "STEP-002",
        processStepDescription: "Is approval required?",
        shapeType: "Decision",
        functionName: "Operations",
        phase: "Main Process",
        sourceStepType: "decision",
        outgoingConnectionCount: 2,
        nextStepId: "STEP-003",
        connectorLabel: "Yes",
      },
      {
        processStepId: "STEP-002",
        processStepDescription: "Is approval required?",
        shapeType: "Decision",
        functionName: "Operations",
        phase: "Main Process",
        sourceStepType: "decision",
        outgoingConnectionCount: 2,
        nextStepId: "STEP-004",
        connectorLabel: "No",
      },
    ]);
  });

  test("preserves terminal steps with one empty-target row", () => {
    const rows = createRowsForProcessStep({
      id: "STEP-004",
      type: "end",
      label: "Process completed",
      owner: "Operations",
      connections: [],
    });

    expect(rows).toEqual([
      {
        processStepId: "STEP-004",
        processStepDescription: "Process completed",
        shapeType: "Start/End",
        functionName: "Operations",
        phase: "Main Process",
        sourceStepType: "end",
        outgoingConnectionCount: 0,
        nextStepId: "",
        connectorLabel: "",
      },
    ]);
  });
});

// ========================================
// Complete Process Model Row Tests
// ========================================

describe("createVisioProcessRows", () => {
  test("flattens all process steps into Visio-ready rows", () => {
    const rows = createVisioProcessRows({
      processName: "Approval Process",
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
          type: "end",
          label: "Approved",
          owner: "Operations",
          connections: [],
        },
        {
          id: "STEP-004",
          type: "end",
          label: "Not required",
          owner: "Operations",
          connections: [],
        },
      ],
      warnings: [],
    });

    expect(rows).toHaveLength(5);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          processStepId: "STEP-001",
          nextStepId: "STEP-002",
          connectorLabel: "",
        }),
        expect.objectContaining({
          processStepId: "STEP-002",
          nextStepId: "STEP-003",
          connectorLabel: "Yes",
        }),
        expect.objectContaining({
          processStepId: "STEP-002",
          nextStepId: "STEP-004",
          connectorLabel: "No",
        }),
        expect.objectContaining({
          processStepId: "STEP-003",
          nextStepId: "",
          connectorLabel: "",
        }),
        expect.objectContaining({
          processStepId: "STEP-004",
          nextStepId: "",
          connectorLabel: "",
        }),
      ])
    );
  });
});

test("uses a custom phase and safely handles invalid connection fields", () => {
  const rows = createRowsForProcessStep(
    {
      id: "STEP-005",
      type: "process",
      label: "Review exception",
      owner: "Operations",
      connections: [
        {
          targetStepId: null,
          label: 123,
        },
      ],
    },
    "Exception Handling"
  );

  expect(rows).toEqual([
    {
      processStepId: "STEP-005",
      processStepDescription: "Review exception",
      shapeType: "Process",
      functionName: "Operations",
      phase: "Exception Handling",
      sourceStepType: "process",
      outgoingConnectionCount: 1,
      nextStepId: "",
      connectorLabel: "",
    },
  ]);
});