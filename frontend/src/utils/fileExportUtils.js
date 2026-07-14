// ========================================
// File Export Utilities
// ========================================

/**
 * Converts a process name into a filesystem-friendly filename segment.
 *
 * The utility:
 * - Trims surrounding whitespace
 * - Converts the value to lowercase
 * - Replaces groups of unsupported characters with hyphens
 * - Removes leading and trailing hyphens
 *
 * Keeping filename normalization separate allows future JSON, Excel, and Visio
 * exports to follow the same naming convention.
 *
 * @param {unknown} value
 * The value that should be converted into a safe filename segment.
 *
 * @param {string} [fallbackName="process-model"]
 * Filename segment used when the supplied value does not contain usable text.
 *
 * @returns {string}
 * A normalized filename segment without a file extension.
 */
const createSafeFilename = (
  value,
  fallbackName = "process-model"
) => {
  if (typeof value !== "string" || !value.trim()) {
    return fallbackName;
  }

  const normalizedFilename = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalizedFilename || fallbackName;
};

/**
 * Triggers a browser download for a Blob.
 *
 * Browsers require a temporary object URL to download dynamically generated
 * content. The object URL is revoked after the synthetic link is activated so
 * the browser can release the associated memory.
 *
 * The temporary anchor is also removed immediately after the download begins,
 * preventing hidden elements from accumulating in the document.
 *
 * @param {Blob} fileBlob
 * The generated file content represented as a Blob.
 *
 * @param {string} filename
 * The complete filename presented to the user, including its extension.
 *
 * @returns {void}
 *
 * @throws {Error}
 * Throws when the supplied Blob or filename is invalid.
 */
const downloadBlob = (fileBlob, filename) => {
  if (!(fileBlob instanceof Blob)) {
    throw new Error("A valid file Blob is required.");
  }

  if (typeof filename !== "string" || !filename.trim()) {
    throw new Error("A valid download filename is required.");
  }

  const objectUrl = URL.createObjectURL(fileBlob);
  const downloadLink = document.createElement("a");

  downloadLink.href = objectUrl;
  downloadLink.download = filename.trim();
  downloadLink.style.display = "none";

  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();

  URL.revokeObjectURL(objectUrl);
};

/**
 * Exports a structured process model as a formatted JSON file.
 *
 * The JSON output uses two-space indentation so the exported model remains
 * readable in code editors, documentation tools, source control, and future
 * import workflows.
 *
 * A newline is appended to the file because many development tools expect text
 * files to end with a trailing newline.
 *
 * @param {object} processModel
 * The complete reviewed process model to export.
 *
 * @returns {void}
 *
 * @throws {Error}
 * Throws when the supplied process model is missing or invalid.
 */
const exportProcessModelAsJson = (processModel) => {
  if (!processModel || typeof processModel !== "object") {
    throw new Error(
      "A valid process model is required for JSON export."
    );
  }

  const filenameBase = createSafeFilename(
    processModel.processName
  );

  const jsonContent = `${JSON.stringify(
    processModel,
    null,
    2
  )}\n`;

  const jsonBlob = new Blob(
    [jsonContent],
    {
      type: "application/json;charset=utf-8",
    }
  );

  downloadBlob(
    jsonBlob,
    `${filenameBase}.json`
  );
};

export {
  createSafeFilename,
  downloadBlob,
  exportProcessModelAsJson,
};