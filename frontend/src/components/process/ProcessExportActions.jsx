// ========================================
// Process Export Actions Component
// ========================================

/**
 * Displays the export formats available for the reviewed process model.
 *
 * This component remains presentation-focused. It does not generate files or
 * perform process validation directly. Instead, it receives export readiness,
 * validation counts, loading state, and export callbacks from its parent.
 *
 * Current export formats:
 * - JSON: Preserves the complete structured process model
 * - Visio-ready Excel: Provides tabular process data for Visio Data Visualizer
 *
 * Future versions may also include:
 * - Direct VSDX generation
 * - Requirements traceability reports
 * - Diagram image or PDF exports
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.canExport
 * Indicates whether no blocking validation errors remain.
 * @param {number} props.errorCount
 * Number of blocking validation errors currently present.
 * @param {number} props.warningCount
 * Number of non-blocking validation warnings currently present.
 * @param {boolean} props.isExportingVisio
 * Indicates whether the Visio-ready workbook is currently being generated.
 * @param {() => void} props.onExportJson
 * Generates and downloads the current process model as JSON.
 * @param {() => Promise<void>} props.onExportVisio
 * Generates and downloads the current process model as a Visio-ready workbook.
 * @returns {JSX.Element} The process export controls.
 */
const ProcessExportActions = ({
  canExport,
  errorCount,
  warningCount,
  isExportingVisio,
  onExportJson,
  onExportVisio,
}) => {
  /**
   * Builds the readiness message displayed above the export controls.
   *
   * Blocking errors disable every export format. Warnings remain visible but do
   * not prevent export because they identify review concerns rather than
   * structurally invalid process data.
   */
  const exportStatusMessage = canExport
    ? warningCount > 0
      ? `${warningCount} ${
          warningCount === 1 ? "warning remains" : "warnings remain"
        }, but export is available.`
      : "The process model is ready for export."
    : `Resolve ${errorCount} ${
        errorCount === 1 ? "blocking error" : "blocking errors"
      } before exporting.`;

  return (
    <section
      className="process-export-actions"
      aria-labelledby="process-export-heading"
    >
      <div className="process-export-actions__content">
        <p className="process-export-actions__eyebrow">
          Export
        </p>

        <h3
          id="process-export-heading"
          className="process-export-actions__title"
        >
          Generate process files
        </h3>

        <p className="process-export-actions__description">
          Export the reviewed process model for storage, testing, or use with
          downstream diagram-generation tools.
        </p>

        <p
          className={[
            "process-export-actions__status",
            canExport
              ? "process-export-actions__status--ready"
              : "process-export-actions__status--blocked",
          ].join(" ")}
        >
          {exportStatusMessage}
        </p>
      </div>

      <div className="process-export-actions__controls">
        <button
          type="button"
          className="process-export-actions__button"
          onClick={onExportJson}
          disabled={!canExport || isExportingVisio}
        >
          Export JSON
        </button>

        <button
          type="button"
          className="process-export-actions__button process-export-actions__button--primary"
          onClick={onExportVisio}
          disabled={!canExport || isExportingVisio}
        >
          {isExportingVisio
            ? "Generating Workbook..."
            : "Export for Visio"}
        </button>
      </div>
    </section>
  );
};

export default ProcessExportActions;