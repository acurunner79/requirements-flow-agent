/**
 * @vitest-environment jsdom
 */

import {
  afterEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import {
  fireEvent,
  cleanup,
  render,
  screen,
} from "@testing-library/react";

import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";

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

  /**
   * Confirms that rendered process connectors reference the shared SVG arrow
   * marker so users can understand the direction of each workflow transition.
   */
  test("renders arrowheads on process connectors", () => {
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
          owner: "Approver",
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
     * The connector should reference the reusable marker definition placed in
     * the diagram SVG.
     */
    expect(
      screen.getByTestId(
        "process-connector-step-1-step-2"
      )
    ).toHaveAttribute(
      "marker-end",
      "url(#process-diagram-arrowhead)"
    );
  });

  /**
   * Confirms that the diagram provides the basic controls users need to adjust
   * the viewport without relying exclusively on mouse or trackpad gestures.
   */
  test("renders diagram zoom controls", () => {
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
          owner: "Approver",
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
     * Accessible labels allow the controls to work with screen readers while
     * also giving the tests stable, user-focused selectors.
     */
    expect(
      screen.getByRole("button", {
        name: "Zoom in",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Zoom out",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Reset diagram view",
      })
    ).toBeInTheDocument();
  });

  /**
   * Confirms that the diagram zoom controls update the visible zoom level and
   * that the reset control restores the default 100% view.
   */
  test("updates and resets the diagram zoom level", async () => {
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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    expect(
      screen.getByText("100%")
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Zoom in",
      })
    );

    expect(
      screen.getByText("110%")
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Zoom out",
      })
    );

    expect(
      screen.getByText("100%")
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Zoom in",
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: "Reset diagram view",
      })
    );

    expect(
      screen.getByText("100%")
    ).toBeInTheDocument();
  });

  /**
   * Confirms that changing the zoom level applies a matching scale transform to
   * the diagram content rather than updating only the visible percentage label.
   */
  test("applies the selected zoom level to the diagram content", async () => {
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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    const diagramContent = screen.getByTestId(
      "process-diagram-content"
    );

    expect(diagramContent).toHaveStyle({
      transform: "translate(0px, 0px) scale(1)",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Zoom in",
      })
    );

    expect(diagramContent).toHaveStyle({
      transform: "translate(0px, 0px) scale(1.1)",
    });
  });

  /**
   * Confirms that dragging within the diagram viewport translates the diagram
   * content, allowing users to navigate workflows larger than the visible area.
   */
  test("pans the diagram content by dragging the viewport", () => {
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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    const diagramViewport = screen.getByTestId(
      "process-diagram-viewport"
    );

    const diagramContent = screen.getByTestId(
      "process-diagram-content"
    );

    fireEvent.mouseDown(diagramViewport, {
      clientX: 100,
      clientY: 100,
    });

    fireEvent.mouseMove(diagramViewport, {
      clientX: 140,
      clientY: 125,
    });

    fireEvent.mouseUp(diagramViewport);

    expect(diagramContent).toHaveStyle({
      transform: "translate(40px, 25px) scale(1)",
    });
  });

  /**
   * Confirms that users can request an automatic fit-to-screen view from the
   * same accessible control group used for zooming and resetting the diagram.
   */
  test("renders a fit-to-screen control", () => {
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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Fit diagram to screen",
      })
    ).toBeInTheDocument();
  });

  /**
   * Confirms that the fit-to-screen control calculates a scale that keeps the
   * complete diagram within the available viewport and resets prior panning.
   */
  test("fits the diagram content within the viewport", async () => {
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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    const diagramViewport = screen.getByTestId(
      "process-diagram-viewport"
    );

    const diagramContent = screen.getByTestId(
      "process-diagram-content"
    );

    /**
     * JSDOM does not calculate real layout dimensions, so define stable
     * viewport and content measurements for this behavior test.
     */
    Object.defineProperty(
      diagramViewport,
      "clientWidth",
      {
        configurable: true,
        value: 600,
      }
    );

    Object.defineProperty(
      diagramViewport,
      "clientHeight",
      {
        configurable: true,
        value: 400,
      }
    );

    Object.defineProperty(
      diagramContent,
      "scrollWidth",
      {
        configurable: true,
        value: 1200,
      }
    );

    Object.defineProperty(
      diagramContent,
      "scrollHeight",
      {
        configurable: true,
        value: 800,
      }
    );

    await user.click(
      screen.getByRole("button", {
        name: "Fit diagram to screen",
      })
    );

    expect(diagramContent).toHaveStyle({
      transform: "translate(0px, 0px) scale(0.5)",
    });

    expect(
      screen.getByText("50%")
    ).toBeInTheDocument();
  });

  /**
   * Confirms that large workflows provide accessible directional controls for
   * moving around the diagram without requiring mouse-drag gestures.
   */
  test("renders directional diagram navigation controls", () => {
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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Move diagram up",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Move diagram down",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Move diagram left",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Move diagram right",
      })
    ).toBeInTheDocument();
  });

  /**
   * Confirms that the directional navigation controls move the diagram by the
   * configured pan distance in each direction.
   */
  test("moves the diagram with directional navigation controls", async () => {
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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    const diagramContent = screen.getByTestId(
      "process-diagram-content"
    );

    await user.click(
      screen.getByRole("button", {
        name: "Move diagram right",
      })
    );

    expect(diagramContent).toHaveStyle({
      transform: "translate(80px, 0px) scale(1)",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Move diagram down",
      })
    );

    expect(diagramContent).toHaveStyle({
      transform: "translate(80px, 80px) scale(1)",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Move diagram left",
      })
    );

    await user.click(
      screen.getByRole("button", {
        name: "Move diagram up",
      })
    );

    expect(diagramContent).toHaveStyle({
      transform: "translate(0px, 0px) scale(1)",
    });
  });

  /**
   * Confirms that selecting a diagram node reports its step identifier so the
   * parent workspace can synchronize the matching editor section.
   */
  test("reports the selected process step", async () => {
    const user = userEvent.setup();
    const handleStepSelect = vi.fn();

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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
        onStepSelect={handleStepSelect}
      />
    );

    await user.click(
      screen.getByText("Submit request")
    );

    expect(handleStepSelect).toHaveBeenCalledTimes(1);
    expect(handleStepSelect).toHaveBeenCalledWith(
      "step-1"
    );
  });

  /**
   * Confirms that keyboard users can select a process step with the same
   * callback used for pointer-based node selection.
   */
  test("supports keyboard selection for process steps", async () => {
    const user = userEvent.setup();
    const handleStepSelect = vi.fn();

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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
        onStepSelect={handleStepSelect}
      />
    );

    const processStep = screen.getByRole("button", {
      name: "Select Submit request",
    });

    processStep.focus();

    await user.keyboard("{Enter}");

    expect(handleStepSelect).toHaveBeenCalledTimes(1);
    expect(handleStepSelect).toHaveBeenCalledWith(
      "step-1"
    );
  });

  /**
   * Confirms that the diagram visually identifies the step selected by the
   * parent workspace.
   */
  test("marks the selected process step in the diagram", () => {
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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    render(
      <ProcessDiagramPreview
        processModel={processModel}
        selectedStepId="step-1"
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Select Submit request",
      })
    ).toHaveClass(
      "process-diagram-preview__node--selected"
    );
  });

  /**
   * Confirms that process steps with validation problems receive a dedicated
   * visual state in the diagram.
   */
  test("highlights process steps with validation issues", () => {
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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    const validationIssues = [
      {
        code: "MISSING_STEP_DESCRIPTION",
        severity: "error",
        stepId: "step-1",
        message: "Enter a step description.",
      },
    ];

    render(
      <ProcessDiagramPreview
        processModel={processModel}
        validationIssues={validationIssues}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Select Submit request",
      })
    ).toHaveClass(
      "process-diagram-preview__node--validation-error"
    );
  });

  /**
   * Confirms that non-blocking validation warnings receive their own visual
   * state instead of being styled like blocking errors.
   */
  test("highlights process steps with validation warnings", () => {
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
          owner: "Approver",
          connections: [],
        },
      ],
    };

    const validationIssues = [
      {
        code: "UNUSED_ACTOR",
        severity: "warning",
        stepId: "step-1",
        message: "Review this process step.",
      },
    ];

    render(
      <ProcessDiagramPreview
        processModel={processModel}
        validationIssues={validationIssues}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Select Submit request",
      })
    ).toHaveClass(
      "process-diagram-preview__node--validation-warning"
    );
  });
});