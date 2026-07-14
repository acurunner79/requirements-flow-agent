import ExcelJS from "exceljs";
import {
  createSafeFilename,
  downloadBlob,
} from "./fileExportUtils";

// ========================================
// Visio Data Visualizer Configuration
// ========================================

/**
 * Defines the worksheet name used by the generated Excel workbook.
 *
 * Keeping this value centralized prevents inconsistencies if workbook creation,
 * validation, or future import features need to reference the same sheet.
 */
const PROCESS_WORKSHEET_NAME = "Process Map";

/**
 * Defines the Excel table name used for the process data.
 *
 * Excel table names cannot contain spaces or most punctuation. A stable table
 * name also makes the workbook easier to inspect and can support future
 * automation that reads the exported process table.
 */
const PROCESS_TABLE_NAME = "ProcessMapData";

/**
 * Defines the worksheet columns used by the Visio-ready process workbook.
 *
 * The first columns align with the data commonly needed to build a process
 * diagram:
 * - A unique step identifier
 * - A human-readable step description
 * - The identifier of the next connected step
 * - A connector label
 * - A shape type
 * - The responsible function or actor
 * - A process phase
 *
 * Additional columns preserve useful process metadata for review and future
 * traceability features.
 */
const PROCESS_COLUMNS = [
  {
    header: "Process Step ID",
    key: "processStepId",
    width: 20,
  },
  {
    header: "Process Step Description",
    key: "processStepDescription",
    width: 42,
  },
  {
    header: "Next Step ID",
    key: "nextStepId",
    width: 22,
  },
  {
    header: "Connector Label",
    key: "connectorLabel",
    width: 22,
  },
  {
    header: "Shape Type",
    key: "shapeType",
    width: 20,
  },
  {
    header: "Function",
    key: "functionName",
    width: 24,
  },
  {
    header: "Phase",
    key: "phase",
    width: 20,
  },
  {
    header: "Source Step Type",
    key: "sourceStepType",
    width: 18,
  },
  {
    header: "Outgoing Connection Count",
    key: "outgoingConnectionCount",
    width: 24,
  },
];

// ========================================
// Visio Shape Mapping
// ========================================

/**
 * Maps the application's process-step types to labels suitable for Visio
 * flowchart shape selection.
 *
 * The application uses concise internal values such as `start` and `process`.
 * The workbook uses more descriptive shape labels so users can map them
 * directly when creating a Visio Data Visualizer diagram.
 */
const VISIO_SHAPE_TYPE_MAP = {
  start: "Start/End",
  process: "Process",
  decision: "Decision",
  end: "Start/End",
};

// ========================================
// Process Workbook Data Helpers
// ========================================

/**
 * Converts an internal process-step type into its Visio shape label.
 *
 * Unsupported values fall back to "Process" so the workbook still contains a
 * usable shape type. The original application type is preserved separately in
 * the `Source Step Type` column for review.
 *
 * @param {unknown} stepType
 * The process-step type stored in the application model.
 *
 * @returns {string}
 * A Visio-compatible flowchart shape label.
 */
const getVisioShapeType = (stepType) => {
  if (typeof stepType !== "string") {
    return "Process";
  }

  const normalizedStepType = stepType.trim().toLowerCase();

  return VISIO_SHAPE_TYPE_MAP[normalizedStepType] || "Process";
};

/**
 * Returns the rich outgoing connections for one process step.
 *
 * `connections` is the authoritative process-path structure used by the
 * frontend and export pipeline.
 *
 * A defensive empty-array fallback prevents workbook generation from failing
 * when an incomplete step reaches the exporter.
 *
 * @param {object} step
 * Process step containing outgoing-path data.
 *
 * @returns {Array<object>}
 * Rich connection objects with target identifiers and optional labels.
 */
const getStepConnections = (step) => {
  return Array.isArray(step.connections)
    ? step.connections
    : [];
};

/**
 * Converts one process step into one or more Visio workbook rows.
 *
 * Rich `connections` objects preserve both destination identifiers and optional
 * connector labels such as Yes, No, Approved, or Rejected.
 *
 * A step with multiple outgoing connections creates one workbook row per
 * connection. Repeating the source-step data allows Visio to create every
 * connector independently.
 *
 * A terminal or disconnected step still produces one row with an empty target
 * and connector label so its shape remains present in the workbook.
 *
 * @param {object} step
 * Structured process step to transform.
 *
 * @param {string} [defaultPhase="Main Process"]
 * Phase name assigned while explicit process-phase metadata is not yet
 * supported.
 *
 * @returns {Array<object>}
 * One or more normalized worksheet row objects.
 */
const createRowsForProcessStep = (
  step,
  defaultPhase = "Main Process"
) => {
  /**
   * Resolve the authoritative rich connection collection for this step.
   */
  const connections = getStepConnections(step);

  const sharedRowData = {
    processStepId: step.id,
    processStepDescription: step.label,
    shapeType: getVisioShapeType(step.type),
    functionName: step.owner,
    phase: defaultPhase,
    sourceStepType: step.type,
    outgoingConnectionCount: connections.length,
  };

  /**
   * Preserve terminal or disconnected steps by writing one row without a
   * connected target.
   */
  if (connections.length === 0) {
    return [
      {
        ...sharedRowData,
        nextStepId: "",
        connectorLabel: "",
      },
    ];
  }

  /**
   * Create one row per outgoing connection.
   *
   * Connector labels are written directly to the workbook so Visio can display
   * decision outcomes and other branch descriptions on generated connectors.
   */
  return connections.map((connection) => ({
    ...sharedRowData,

    nextStepId:
      typeof connection.targetStepId === "string"
        ? connection.targetStepId.trim()
        : "",

    connectorLabel:
      typeof connection.label === "string"
        ? connection.label.trim()
        : "",
  }));
};

/**
 * Converts the complete process model into flattened worksheet rows.
 *
 * Flat row data is easier for Excel tables and Visio Data Visualizer mappings
 * to consume than the nested `steps` structure used by the application.
 *
 * @param {object} processModel
 * The reviewed structured process model.
 *
 * @returns {Array<object>}
 * Flattened process rows ready for insertion into the workbook.
 */
const createVisioProcessRows = (processModel) => {
  return processModel.steps.flatMap((step) =>
    createRowsForProcessStep(step)
  );
};

// ========================================
// Workbook Styling Helpers
// ========================================

/**
 * Applies consistent enterprise styling to the workbook header row.
 *
 * The workbook remains functional without styling, but a clear header improves
 * readability when users review or adjust mappings before opening the file in
 * Visio.
 *
 * @param {ExcelJS.Row} headerRow
 * The worksheet header row to style.
 *
 * @returns {void}
 */
const styleHeaderRow = (headerRow) => {
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: {
        argb: "FFFFFFFF",
      },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FF000000",
      },
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
    };

    cell.border = {
      bottom: {
        style: "thin",
        color: {
          argb: "FFA100FF",
        },
      },
    };
  });
};

/**
 * Applies readable alignment and wrapping to all process-data rows.
 *
 * Text wrapping prevents longer process descriptions from being hidden when the
 * workbook is opened in Excel.
 *
 * @param {ExcelJS.Worksheet} worksheet
 * The process worksheet containing the exported rows.
 *
 * @returns {void}
 */
const styleProcessRows = (worksheet) => {
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    row.alignment = {
      vertical: "top",
      wrapText: true,
    };

    row.height = 32;
  });
};

/**
 * Adds a brief instruction section to the right of the process table.
 *
 * These notes explain the intended workbook use without interfering with the
 * structured table consumed by Visio.
 *
 * @param {ExcelJS.Worksheet} worksheet
 * The worksheet receiving the instruction notes.
 *
 * @returns {void}
 */
const addWorkbookInstructions = (worksheet) => {
  const instructionColumn = PROCESS_COLUMNS.length + 2;

  const titleCell = worksheet.getCell(1, instructionColumn);
  titleCell.value = "Visio Import Notes";
  titleCell.font = {
    bold: true,
    size: 12,
  };

  const instructions = [
    "Use this workbook with a Visio Data Visualizer flowchart template.",
    "Map Process Step ID as the unique identifier.",
    "Map Next Step ID as the connected-step identifier.",
    "Map Function to the cross-functional swimlane field.",
    "Map Connector Label to the connector text field for decision outcomes.",
  ];

  instructions.forEach((instruction, index) => {
    const cell = worksheet.getCell(index + 2, instructionColumn);
    cell.value = `• ${instruction}`;
    cell.alignment = {
      vertical: "top",
      wrapText: true,
    };
  });

  worksheet.getColumn(instructionColumn).width = 44;
};

// ========================================
// Visio Workbook Export
// ========================================

/**
 * Generates and downloads a Visio-ready Excel workbook from a process model.
 *
 * The export workflow:
 * 1. Validates the required process-model structure
 * 2. Converts nested process steps into flat connector rows
 * 3. Creates an Excel worksheet and structured table
 * 4. Applies readable workbook formatting
 * 5. Serializes the workbook into an XLSX buffer
 * 6. Downloads the generated file through the shared Blob utility
 *
 * @param {object} processModel
 * The reviewed and validated process model to export.
 *
 * @returns {Promise<void>}
 * Resolves after the workbook has been generated and the browser download has
 * been triggered.
 *
 * @throws {Error}
 * Throws when the supplied process model is invalid or workbook generation
 * fails.
 */
const exportProcessModelForVisio = async (processModel) => {
  if (
    !processModel ||
    typeof processModel !== "object" ||
    !Array.isArray(processModel.steps) ||
    processModel.steps.length === 0
  ) {
    throw new Error(
      "A valid process model with process steps is required for Visio export."
    );
  }

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "Requirements Flow Agent";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = processModel.processName;
  workbook.title = `${processModel.processName} - Visio Process Data`;
  workbook.description =
    "Structured process data generated for Microsoft Visio Data Visualizer.";

  const worksheet = workbook.addWorksheet(PROCESS_WORKSHEET_NAME, {
    views: [
      {
        state: "frozen",
        ySplit: 1,
      },
    ],
  });

  worksheet.columns = PROCESS_COLUMNS;

  const processRows = createVisioProcessRows(processModel);

  /////////////////////////////////////////////////////////////////////////
  // Removed the direct row addition to the worksheet in favor of using an Excel table for better structure and usability.
  /////////////////////////////////////////////////////////////////////////
  // processRows.forEach((rowData) => {
  //   worksheet.addRow(rowData);
  // });
  /////////////////////////////////////////////////////////////////////////

  /**
   * Convert the process data into a formal Excel table.
   *
   * Excel tables provide filters, clear column boundaries, and a predictable
   * data range for users reviewing the workbook before importing it into Visio.
   */
  worksheet.addTable({
    name: PROCESS_TABLE_NAME,
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium2",
      showRowStripes: true,
      showFirstColumn: false,
      showLastColumn: false,
    },
    columns: PROCESS_COLUMNS.map((column) => ({
      name: column.header,
      filterButton: true,
    })),
    rows: processRows.map((row) => [
      row.processStepId,
      row.processStepDescription,
      row.nextStepId,
      row.connectorLabel,
      row.shapeType,
      row.functionName,
      row.phase,
      row.sourceStepType,
      row.outgoingConnectionCount,
    ]),
  });

  styleHeaderRow(worksheet.getRow(1));
  styleProcessRows(worksheet);
  addWorkbookInstructions(worksheet);

  const workbookBuffer = await workbook.xlsx.writeBuffer();

  const workbookBlob = new Blob(
    [workbookBuffer],
    {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  );

  const filenameBase = createSafeFilename(
    processModel.processName
  );

  downloadBlob(
    workbookBlob,
    `${filenameBase}-visio-process.xlsx`
  );
};

export {
  createRowsForProcessStep,
  createVisioProcessRows,
  exportProcessModelForVisio,
  getStepConnections,
  getVisioShapeType,
};