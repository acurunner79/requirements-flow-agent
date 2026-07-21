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
 * Confirms that multiple branches leaving the same decision node receive
 * separate horizontal routing channels instead of overlapping one another.
 */
test("separates routing channels for sibling decision branches", () => {
  const originalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;

  /**
   * JSDOM does not perform visual layout, so provide deterministic geometry for
   * the rendered diagram surface and its three process nodes.
   */
  HTMLElement.prototype.getBoundingClientRect =
    function getBoundingClientRectMock() {
      if (
        this.dataset.testid ===
        "process-diagram-content"
      ) {
        return {
          left: 0,
          top: 0,
          right: 1000,
          bottom: 600,
          width: 1000,
          height: 600,
          x: 0,
          y: 0,
          toJSON: () => {},
        };
      }

      const accessibleName =
        this.getAttribute("aria-label");

      if (
        accessibleName ===
        "Select Is approval required?"
      ) {
        return {
          left: 100,
          top: 100,
          right: 300,
          bottom: 170,
          width: 200,
          height: 70,
          x: 100,
          y: 100,
          toJSON: () => {},
        };
      }

      if (
        accessibleName ===
        "Select Approve request"
      ) {
        return {
          left: 500,
          top: 80,
          right: 700,
          bottom: 150,
          width: 200,
          height: 70,
          x: 500,
          y: 80,
          toJSON: () => {},
        };
      }

      if (
        accessibleName ===
        "Select Reject request"
      ) {
        return {
          left: 500,
          top: 240,
          right: 700,
          bottom: 310,
          width: 200,
          height: 70,
          x: 500,
          y: 240,
          toJSON: () => {},
        };
      }

      return originalGetBoundingClientRect.call(
        this
      );
    };

  const processModel = {
    processName: "Approval Decision",
    actors: [
      "Requester",
      "Approver",
    ],
    steps: [
      {
        id: "step-1",
        type: "decision",
        label: "Is approval required?",
        owner: "Requester",
        connections: [
          {
            targetStepId: "step-2",
            label: "Yes",
          },
          {
            targetStepId: "step-3",
            label: "No",
          },
        ],
      },
      {
        id: "step-2",
        type: "process",
        label: "Approve request",
        owner: "Approver",
        connections: [],
      },
      {
        id: "step-3",
        type: "process",
        label: "Reject request",
        owner: "Approver",
        connections: [],
      },
    ],
  };

  try {
    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    const approveConnector =
      screen.getByTestId(
        "process-connector-step-1-step-2"
      );

    const rejectConnector =
      screen.getByTestId(
        "process-connector-step-1-step-3"
      );

    expect(
      approveConnector.getAttribute("d")
    ).not.toBe(
      rejectConnector.getAttribute("d")
    );

    /**
     * Each sibling branch should expose its assigned routing-channel index so
     * the path separation remains deterministic and testable.
     */
    expect(approveConnector).toHaveAttribute(
      "data-route-index",
      "0"
    );

    expect(rejectConnector).toHaveAttribute(
      "data-route-index",
      "1"
    );
  } finally {
    HTMLElement.prototype.getBoundingClientRect =
      originalGetBoundingClientRect;
  }
});

/**
 * Confirms that a swimlane uses row positions relative to its own first node.
 *
 * A branch may receive a lower global workflow row, but that should not create
 * empty rows above the first visible node inside a different actor's lane.
 */
test("removes unused leading rows from each swimlane", () => {
  const processModel = {
    processName: "Approval Routing",
    actors: [
      "Requester",
      "Reviewer",
    ],
    steps: [
      {
        id: "step-1",
        type: "decision",
        label: "Choose review path",
        owner: "Requester",
        connections: [
          {
            targetStepId: "step-2",
            label: "Standard",
          },
          {
            targetStepId: "step-3",
            label: "Escalate",
          },
        ],
      },
      {
        id: "step-2",
        type: "process",
        label: "Continue standard path",
        owner: "Requester",
        connections: [],
      },
      {
        id: "step-3",
        type: "process",
        label: "Review escalated request",
        owner: "Reviewer",
        connections: [],
      },
    ],
  };

  render(
    <ProcessDiagramPreview
      processModel={processModel}
    />
  );

  const reviewerNode = screen.getByRole(
    "button",
    {
      name: "Select Review escalated request",
    }
  );

  /**
   * The layout utility assigns this secondary branch global row 1. Because it
   * is the first occupied row in the Reviewer lane, it should render in that
   * lane's first CSS Grid row rather than leaving an empty row above it.
   */
  expect(reviewerNode).toHaveStyle({
    gridRow: "1",
  });

  expect(reviewerNode).toHaveAttribute(
    "data-row",
    "1"
  );

  expect(reviewerNode).toHaveAttribute(
    "data-lane-row",
    "0"
  );
});

/**
 * Confirms that a branch label remains near the decision node that created the
 * connection rather than being placed halfway along a long cross-lane route.
 */
test("positions branch labels near their source decision", () => {
  const originalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;

  /**
   * JSDOM does not calculate diagram geometry, so provide stable measurements
   * for one decision and one target located in a lower swimlane.
   */
  HTMLElement.prototype.getBoundingClientRect =
    function getBoundingClientRectMock() {
      if (
        this.dataset.testid ===
        "process-diagram-content"
      ) {
        return {
          left: 0,
          top: 0,
          right: 1000,
          bottom: 700,
          width: 1000,
          height: 700,
          x: 0,
          y: 0,
          toJSON: () => {},
        };
      }

      const accessibleName =
        this.getAttribute("aria-label");

      if (
        accessibleName ===
        "Select Is approval required?"
      ) {
        return {
          left: 100,
          top: 100,
          right: 300,
          bottom: 170,
          width: 200,
          height: 70,
          x: 100,
          y: 100,
          toJSON: () => {},
        };
      }

      if (
        accessibleName ===
        "Select Route for review"
      ) {
        return {
          left: 500,
          top: 500,
          right: 700,
          bottom: 570,
          width: 200,
          height: 70,
          x: 500,
          y: 500,
          toJSON: () => {},
        };
      }

      return originalGetBoundingClientRect.call(
        this
      );
    };

  const processModel = {
    processName: "Approval Routing",
    actors: [
      "Requester",
      "Reviewer",
    ],
    steps: [
      {
        id: "step-1",
        type: "decision",
        label: "Is approval required?",
        owner: "Requester",
        connections: [
          {
            targetStepId: "step-2",
            label: "Yes",
          },
        ],
      },
      {
        id: "step-2",
        type: "process",
        label: "Route for review",
        owner: "Reviewer",
        connections: [],
      },
    ],
  };

  try {
    render(
      <ProcessDiagramPreview
        processModel={processModel}
      />
    );

    const branchLabel = screen.getByTestId(
      "process-connector-label-step-1-step-2"
    );

    /**
     * The source node ends at x=300. The label should remain within the short
     * source-exit area rather than being placed near the route midpoint.
     */
    expect(
      Number(branchLabel.getAttribute("x"))
    ).toBeLessThanOrEqual(360);

    expect(
      Number(branchLabel.getAttribute("y"))
    ).toBeLessThanOrEqual(150);
  } finally {
    HTMLElement.prototype.getBoundingClientRect =
      originalGetBoundingClientRect;
  }
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
 * Confirms that fitting centers the diagram along an axis where the scaled
 * workflow is smaller than the available viewport.
 */
test("centers fitted diagram content within the viewport", async () => {
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

  Object.defineProperty(
    diagramViewport,
    "clientWidth",
    {
      configurable: true,
      value: 800,
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

  /**
   * Height determines the 50% scale. The resulting 600-pixel diagram width is
   * centered inside the 800-pixel viewport with 100 pixels on each side.
   */
  expect(diagramContent).toHaveStyle({
    transform:
      "translate(100px, 0px) scale(0.5)",
  });
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