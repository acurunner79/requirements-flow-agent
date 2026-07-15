/**
 * @vitest-environment jsdom
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  createSafeFilename,
  downloadBlob,
  exportProcessModelAsJson,
} from "../fileExportUtils";

// ========================================
// Browser Download Test Setup
// ========================================

let createObjectUrlMock;
let revokeObjectUrlMock;
let clickMock;
let removeMock;
let appendChildSpy;
let createElementSpy;

/**
 * Creates deterministic browser API mocks before each test.
 *
 * The real export utility relies on object URLs and a temporary anchor element.
 * These mocks verify that behavior without starting an actual browser download.
 */
beforeEach(() => {
  createObjectUrlMock = vi.fn(
    () => "blob:requirements-flow-agent-test"
  );

  revokeObjectUrlMock = vi.fn();
  clickMock = vi.fn();
  removeMock = vi.fn();

  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: createObjectUrlMock,
    revokeObjectURL: revokeObjectUrlMock,
  });

  const mockDownloadLink = {
    href: "",
    download: "",
    style: {},
    click: clickMock,
    remove: removeMock,
  };

  createElementSpy = vi
    .spyOn(document, "createElement")
    .mockReturnValue(mockDownloadLink);

  appendChildSpy = vi
    .spyOn(document.body, "appendChild")
    .mockImplementation(() => mockDownloadLink);
});

/**
 * Restores all browser mocks after each test so one export case cannot affect
 * another test.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ========================================
// Safe Filename Tests
// ========================================

describe("createSafeFilename", () => {
  test("converts a process name into a safe filename segment", () => {
    expect(
      createSafeFilename("  Vendor Invoice Review  ")
    ).toBe("vendor-invoice-review");
  });

  test("replaces unsupported character groups with hyphens", () => {
    expect(
      createSafeFilename(
        "Customer Refund: Review / Approval (2026)"
      )
    ).toBe(
      "customer-refund-review-approval-2026"
    );
  });

  test("removes leading and trailing separators", () => {
    expect(
      createSafeFilename("--- Process Review ---")
    ).toBe("process-review");
  });

  test("uses the default fallback for unusable values", () => {
    expect(createSafeFilename("   ")).toBe(
      "process-model"
    );

    expect(createSafeFilename(null)).toBe(
      "process-model"
    );

    expect(createSafeFilename(42)).toBe(
      "process-model"
    );
  });

  test("uses a supplied fallback name", () => {
    expect(
      createSafeFilename("", "untitled-export")
    ).toBe("untitled-export");

    expect(
      createSafeFilename("***", "untitled-export")
    ).toBe("untitled-export");
  });
});

// ========================================
// File Download Validation Tests
// ========================================

describe("downloadBlob", () => {
  test("rejects values that are not Blob instances", () => {
    expect(() =>
      downloadBlob(
        "invalid file content",
        "process-model.json"
      )
    ).toThrow(
      "A valid file Blob is required."
    );
  });

  test("rejects empty download filenames", () => {
    const fileBlob = new Blob(
      ["test content"],
      {
        type: "text/plain",
      }
    );

    expect(() =>
      downloadBlob(
        fileBlob,
        "   "
      )
    ).toThrow(
      "A valid download filename is required."
    );
  });
});

// ========================================
// JSON Export Validation Tests
// ========================================

describe("exportProcessModelAsJson", () => {
  test("rejects missing or invalid process models", () => {
    expect(() =>
      exportProcessModelAsJson(null)
    ).toThrow(
      "A valid process model is required for JSON export."
    );

    expect(() =>
      exportProcessModelAsJson(undefined)
    ).toThrow(
      "A valid process model is required for JSON export."
    );
  });
});

// ========================================
// Browser Download Behavior Tests
// ========================================

describe("downloadBlob browser behavior", () => {
  test("creates, activates, removes, and revokes a temporary download link", () => {
    const fileBlob = new Blob(
      ["test content"],
      {
        type: "text/plain",
      }
    );

    downloadBlob(
      fileBlob,
      "  process-model.txt  "
    );

    expect(createObjectUrlMock).toHaveBeenCalledWith(
      fileBlob
    );

    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledTimes(1);

    expect(revokeObjectUrlMock).toHaveBeenCalledWith(
      "blob:requirements-flow-agent-test"
    );

    const downloadLink =
      createElementSpy.mock.results[0].value;

    expect(downloadLink.href).toBe(
      "blob:requirements-flow-agent-test"
    );

    expect(downloadLink.download).toBe(
      "process-model.txt"
    );

    expect(downloadLink.style.display).toBe("none");
  });
});

// ========================================
// JSON Export Behavior Tests
// ========================================

describe("exportProcessModelAsJson browser behavior", () => {
  /**
   * Confirms that JSON export creates a formatted application/json Blob and
   * downloads it using the normalized process name.
   */
  test("exports a formatted process model JSON file", async () => {
    const processModel = {
      processName: "Vendor Invoice Review",
      actors: [
        "Accounts Payable",
      ],
      steps: [
        {
          id: "STEP-001",
          type: "end",
          label: "Invoice review completed",
          owner: "Accounts Payable",
          connections: [],
        },
      ],
      warnings: [],
    };

    exportProcessModelAsJson(processModel);

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);

    const exportedBlob =
      createObjectUrlMock.mock.calls[0][0];

    expect(exportedBlob).toBeInstanceOf(Blob);

    expect(exportedBlob.type).toBe(
      "application/json;charset=utf-8"
    );

    const exportedContent =
      await exportedBlob.text();

    expect(exportedContent).toBe(
      `${JSON.stringify(
        processModel,
        null,
        2
      )}\n`
    );

    expect(exportedContent.endsWith("\n")).toBe(true);

    expect(
      exportedContent.includes("nextStepIds")
    ).toBe(false);

    const downloadLink =
      createElementSpy.mock.results[0].value;

    expect(downloadLink.download).toBe(
      "vendor-invoice-review.json"
    );

    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledTimes(1);

    expect(revokeObjectUrlMock).toHaveBeenCalledWith(
      "blob:requirements-flow-agent-test"
    );
  });

  /**
   * Confirms that JSON export falls back to a safe default filename when the
   * process model does not contain a usable process name.
   */
  test("uses the default JSON filename when the process name is missing", () => {
    const processModel = {
      processName: "   ",
      actors: [],
      steps: [],
      warnings: [],
    };

    exportProcessModelAsJson(processModel);

    const downloadLink =
      createElementSpy.mock.results[0].value;

    expect(downloadLink.download).toBe(
      "process-model.json"
    );
  });
});