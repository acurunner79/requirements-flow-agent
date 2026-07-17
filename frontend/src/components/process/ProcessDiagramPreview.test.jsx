/**
 * @vitest-environment jsdom
 */

import {
  afterEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";

import ProcessDiagramPreview from "./ProcessDiagramPreview";

// ========================================
// Component Test Cleanup
// ========================================

/**
 * Removes the rendered diagram preview after every test.
 *
 * Explicit cleanup keeps actor lanes and process nodes from one test from
 * affecting queries performed by later tests.
 */
afterEach(() => {
  cleanup();
});

// ========================================
// Process Diagram Preview Tests
// ========================================

describe("ProcessDiagramPreview", () => {
  /**
   * Confirms that the preview converts the process model into visible actor
   * swimlanes and renders each process step inside the diagram surface.
   */
  test("renders actor swimlanes and process nodes", () => {
    const processModel = {
      name: "Customer Support Request",
      actors: [
        "Customer",
        "Support Agent",
      ],
      steps: [
        {
          id: "step-1",
          type: "start",
          name: "Submit support request",
          owner: "Customer",
          connections: [
            {
              targetStepId: "step-2",
              label: "",
            },
          ],
        },
        {
          id: "step-2",
          type: "process",
          name: "Review support request",
          owner: "Support Agent",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    /**
     * Actor names should be presented as swimlane headings so users can
     * understand who owns each portion of the workflow.
     */
    expect(
      screen.getByRole("heading", {
        name: "Customer",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Support Agent",
      })
    ).toBeInTheDocument();

    /**
     * Every process step should appear as a visible node in the diagram.
     */
    expect(
      screen.getByText("Submit support request")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Review support request")
    ).toBeInTheDocument();
  });

  /**
   * Confirms that each process connection is represented by a connector element
   * linking the source and target steps in the diagram preview.
   */
  test("renders process connectors", () => {
    const processModel = {
      processName: "Customer Support Request",
      actors: [
        "Customer",
        "Support Agent",
      ],
      steps: [
        {
          id: "step-1",
          type: "start",
          label: "Submit support request",
          owner: "Customer",
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
          label: "Review support request",
          owner: "Support Agent",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    /**
     * Connector elements expose their source and target step IDs so later
     * routing, labeling, and interaction behavior can remain deterministic.
     */
    expect(
      screen.getByTestId(
        "process-connector-step-1-step-2"
      )
    ).toBeInTheDocument();
  });

  /**
   * Confirms that a labeled process connection displays its branch text in the
   * diagram preview so decision outcomes remain understandable.
   */
  test("renders branch labels for decision connectors", () => {
    const processModel = {
      processName: "Refund Decision",
      actors: [
        "Customer Service",
        "Manager",
      ],
      steps: [
        {
          id: "step-1",
          type: "decision",
          name: "Is manager approval required?",
          owner: "Customer Service",
          connections: [
            {
              targetStepId: "step-2",
              label: "Yes",
            },
          ],
        },
        {
          id: "step-2",
          type: "end",
          name: "Approve refund",
          owner: "Manager",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    /**
     * Branch text should be associated with the exact connector it describes.
     */
    expect(
      screen.getByTestId(
        "process-connector-label-step-1-step-2"
      )
    ).toHaveTextContent("Yes");
  });
});