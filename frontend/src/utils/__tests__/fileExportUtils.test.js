import { describe, expect, test } from "vitest";

import {
  createSafeFilename,
  downloadBlob,
  exportProcessModelAsJson,
} from "../fileExportUtils";

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