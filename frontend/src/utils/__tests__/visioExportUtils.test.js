import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import ExcelJS from "exceljs";

// ========================================
// Visio Workbook Download Mock
// ========================================

/**
 * Creates a hoisted download mock that can be used by the mocked export module.
 *
 * Hoisting is required because Vitest moves `vi.mock` calls above standard
 * module imports before evaluating the test file.
 */
const {
  downloadBlobMock,
} = vi.hoisted(() => {
  return {
    downloadBlobMock: vi.fn(),
  };
});

/**
 * Preserves the real filename helper while replacing only the browser download
 * function.
 *
 * This allows ExcelJS to generate a real workbook buffer without triggering an
 * actual file download.
 */
vi.mock("../fileExportUtils", async () => {
  const actualModule = await vi.importActual(
    "../fileExportUtils"
  );

  return {
    ...actualModule,
    downloadBlob: downloadBlobMock,
  };
});

import {
  createRowsForProcessStep,
  createVisioProcessRows,
  exportProcessModelForVisio,
  getStepConnections,
  getVisioShapeType,
} from "../visioExportUtils";

// ========================================
// Workbook Export Test Setup
// ========================================

/**
 * Clears captured download calls before each test so workbook assertions remain
 * isolated and deterministic.
 */
beforeEach(() => {
  downloadBlobMock.mockClear();
});

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

// ========================================
// Complete Visio Workbook Export Tests
// ========================================

describe("exportProcessModelForVisio", () => {
  /**
   * Confirms that the complete export workflow creates a readable XLSX workbook
   * containing the expected worksheet, table, headers, process rows, and
   * connector labels.
   *
   * The browser download function is mocked, but ExcelJS performs the real
   * workbook generation and serialization.
   */
  test("generates a Visio-ready workbook with labeled process rows", async () => {
    const processModel = {
      processName: "Vendor Invoice Review",
      actors: [
        "Accounts Payable",
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
          type: "decision",
          label: "Is approval required?",
          owner: "Accounts Payable",
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
          label: "Approve invoice",
          owner: "Finance Manager",
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
          label: "Invoice review completed",
          owner: "Accounts Payable",
          connections: [],
        },
      ],
      warnings: [],
    };

    await exportProcessModelForVisio(processModel);

    expect(downloadBlobMock).toHaveBeenCalledTimes(1);

    const [
      exportedBlob,
      exportedFilename,
    ] = downloadBlobMock.mock.calls[0];

    expect(exportedBlob).toBeInstanceOf(Blob);

    expect(exportedBlob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    expect(exportedFilename).toBe(
      "vendor-invoice-review-visio-process.xlsx"
    );

    /**
     * Load the generated XLSX data back into ExcelJS so the workbook structure
     * can be inspected without writing a temporary file to disk.
     */
    const workbookBuffer =
      await exportedBlob.arrayBuffer();

    const workbook = new ExcelJS.Workbook();

    await workbook.xlsx.load(workbookBuffer);

    const worksheet =
      workbook.getWorksheet("Process Map");

    expect(worksheet).toBeDefined();

    const processTable =
      worksheet.getTable("ProcessMapData");

    expect(processTable).toBeDefined();

    /**
     * Inspect only the nine structured process-table columns.
     *
     * The worksheet also contains Visio import instructions farther to the right,
     * so the complete row includes additional cells that are unrelated to the
     * process table.
     */
    expect(
      worksheet.getRow(1).values.slice(1, 10)
    ).toEqual([
      "Process Step ID",
      "Process Step Description",
      "Next Step ID",
      "Connector Label",
      "Shape Type",
      "Function",
      "Phase",
      "Source Step Type",
      "Outgoing Connection Count",
    ]);

    expect(
      worksheet.getRow(2).values.slice(1, 10)
    ).toEqual([
      "STEP-001",
      "Invoice received",
      "STEP-002",
      "",
      "Start/End",
      "Accounts Payable",
      "Main Process",
      "start",
      1,
    ]);

    expect(
      worksheet.getRow(3).values.slice(1, 10)
    ).toEqual([
      "STEP-002",
      "Is approval required?",
      "STEP-003",
      "Yes",
      "Decision",
      "Accounts Payable",
      "Main Process",
      "decision",
      2,
    ]);

    expect(
      worksheet.getRow(4).values.slice(1, 10)
    ).toEqual([
      "STEP-002",
      "Is approval required?",
      "STEP-004",
      "No",
      "Decision",
      "Accounts Payable",
      "Main Process",
      "decision",
      2,
    ]);

    expect(
      worksheet.getRow(6).values.slice(1, 10)
    ).toEqual([
      "STEP-004",
      "Invoice review completed",
      "",
      "",
      "Start/End",
      "Accounts Payable",
      "Main Process",
      "end",
      0,
    ]);
  });
});