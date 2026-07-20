// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import ProcessModelSummary from "./ProcessModelSummary";

// ========================================
// Process Model Summary Tests
// ========================================

const scrollIntoViewMock = vi.fn();

/**
 * Remove each rendered component after its test so later tests start with a
 * clean document and cannot find stale process-diagram elements.
 */
afterEach(() => {
  cleanup();
  scrollIntoViewMock.mockClear();
});

/**
 * JSDOM does not implement element scrolling, so provide a shared mock for all
 * selection tests that render the synchronized workspace.
 */
Element.prototype.scrollIntoView = scrollIntoViewMock;


describe("ProcessModelSummary", () => {
  /**
   * Confirms that selecting a node in the process diagram marks the matching
   * process-step editor card as selected.
   *
   * This integration test verifies synchronization between the visual diagram
   * and the detailed editor rather than testing either component in isolation.
   */
  test("synchronizes diagram selection with the matching editor card", async () => {
    const user = userEvent.setup();

    const processModel = {
      processName: "Approval Flow",
      actors: [
        "Requester",
        "Approver",
      ],
      steps: [
        {
          id: "step-1",
          type: "start",
          name: "Submit request",
          label: "Submit request",
          owner: "Requester",
          connections: [
            {
              targetStepId: "step-2",
              label: "",
            },
          ],
        },
        {
          id: "step-2",
          type: "end",
          name: "Approve request",
          label: "Approve request",
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessModelSummary
        processModel={processModel}
        onUpdateProcessName={vi.fn()}
        onAddActor={vi.fn()}
        onUpdateActor={vi.fn()}
        onRemoveActor={vi.fn()}
        onUpdateStep={vi.fn()}
        onReorderSteps={vi.fn()}
        onUpdateConnections={vi.fn()}
        onExportJson={vi.fn()}
        onExportVisio={vi.fn()}
        isExportingVisio={false}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "Select Submit request",
      })
    );

    /**
     * Locate the detailed editor card through its displayed step identifier,
     * avoiding ambiguity with the duplicate label shown in the diagram.
     */
    const selectedEditorCard = screen
      .getByText("step-1")
      .closest(".process-step-card");

    expect(selectedEditorCard).toHaveClass(
      "process-step-card--selected"
    );
  });

  /**
   * Confirms that selecting a diagram node brings the matching editor card into
   * view so users can continue reviewing the selected process step immediately.
   */
  test("scrolls the selected editor card into view", async () => {
    const user = userEvent.setup();

    const processModel = {
      processName: "Approval Flow",
      actors: [
        "Requester",
        "Approver",
      ],
      steps: [
        {
          id: "step-1",
          type: "start",
          name: "Submit request",
          label: "Submit request",
          owner: "Requester",
          connections: [
            {
              targetStepId: "step-2",
              label: "",
            },
          ],
        },
        {
          id: "step-2",
          type: "end",
          name: "Approve request",
          label: "Approve request",
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessModelSummary
        processModel={processModel}
        onUpdateProcessName={vi.fn()}
        onAddActor={vi.fn()}
        onUpdateActor={vi.fn()}
        onRemoveActor={vi.fn()}
        onUpdateStep={vi.fn()}
        onReorderSteps={vi.fn()}
        onUpdateConnections={vi.fn()}
        onExportJson={vi.fn()}
        onExportVisio={vi.fn()}
        isExportingVisio={false}
      />
    );

    await user.click(
      screen.getByRole("button", {
        name: "Select Submit request",
      })
    );

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
  });

  /**
   * Confirms that dropping one process-step card onto another sends the moved
   * and target step identifiers to the application-level reorder callback.
   */
  test("requests process step reordering after a drag and drop", () => {
    const handleReorderSteps = vi.fn();

    const processModel = {
      processName: "Approval Flow",
      actors: [
        "Requester",
        "Approver",
      ],
      steps: [
        {
          id: "step-1",
          type: "start",
          name: "Submit request",
          label: "Submit request",
          owner: "Requester",
          connections: [
            {
              targetStepId: "step-2",
              label: "",
            },
          ],
        },
        {
          id: "step-2",
          type: "end",
          name: "Approve request",
          label: "Approve request",
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessModelSummary
        processModel={processModel}
        onUpdateProcessName={vi.fn()}
        onAddActor={vi.fn()}
        onUpdateActor={vi.fn()}
        onRemoveActor={vi.fn()}
        onUpdateStep={vi.fn()}
        onReorderSteps={vi.fn()}
        onReorderSteps={handleReorderSteps}
        onUpdateConnections={vi.fn()}
        onExportJson={vi.fn()}
        onExportVisio={vi.fn()}
        isExportingVisio={false}
      />
    );

  /**
   * Step identifiers can also appear in connection controls, so narrow the
   * lookup to the identifier rendered inside each process-step card.
   */
  const sourceCard = screen
    .getAllByText("step-2")
    .map((element) =>
      element.closest(".process-step-card")
    )
    .find(Boolean);

  const targetCard = screen
    .getAllByText("step-1")
    .map((element) =>
      element.closest(".process-step-card")
    )
    .find(Boolean);

    expect(sourceCard).not.toBeUndefined();
    expect(targetCard).not.toBeUndefined();

    /**
     * JSDOM does not provide a complete native DataTransfer implementation, so
     * supply the small interface used by the process-step drag handlers.
     */
    const dataTransfer = {
      effectAllowed: "",
      dropEffect: "",
      setData: vi.fn(),
      getData: vi.fn(() => "step-2"),
    };

    fireEvent.dragStart(sourceCard, {
      dataTransfer,
    });

    fireEvent.dragOver(targetCard, {
      dataTransfer,
    });

    fireEvent.drop(targetCard, {
      dataTransfer,
    });

    expect(handleReorderSteps).toHaveBeenCalledTimes(1);
    expect(handleReorderSteps).toHaveBeenCalledWith(
      "step-2",
      "step-1"
    );
  });
});