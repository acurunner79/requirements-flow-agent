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
  cleanup,
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

// ========================================
// Requirements Analysis Service Mock
// ========================================

/**
 * Creates a hoisted service mock so App tests can control analysis outcomes
 * without sending requests to the backend or consuming AI-provider tokens.
 */
const {
  analyzeRequirementsMock,
} = vi.hoisted(() => {
  return {
    analyzeRequirementsMock: vi.fn(),
  };
});

/**
 * Replaces only the frontend API service used by App.jsx.
 *
 * All application components and state transitions continue running normally.
 */
vi.mock("./services/requirementsAnalysisService", () => {
  return {
    analyzeRequirements: analyzeRequirementsMock,
  };
});

import App from "./App";

// ========================================
// Application Test Lifecycle
// ========================================

/**
 * Resets service behavior before every test so calls and configured responses
 * cannot leak between workflow scenarios.
 */
beforeEach(() => {
  analyzeRequirementsMock.mockReset();
});

/**
 * Removes the rendered application after every test.
 *
 * Explicit cleanup prevents later queries from finding interface elements left
 * behind by an earlier test.
 */
afterEach(() => {
  cleanup();
});

// ========================================
// Requirements Submission Workflow Tests
// ========================================

describe("App requirements workflow", () => {
  /**
   * Confirms that blank requirements are rejected in the browser before the
   * backend analysis service is called.
   *
   * This avoids unnecessary mock processing and protects paid AI providers from
   * receiving empty requests.
   */
  test("rejects blank requirements without calling the analysis service", async () => {
    const user = userEvent.setup();

    render(<App />);

    await user.click(
      screen.getByRole("button", {
        name: "Analyze Requirements",
      })
    );

    expect(
      screen.getByRole("alert")
    ).toHaveTextContent(
      "Enter business requirements before analyzing."
    );

    expect(
      analyzeRequirementsMock
    ).not.toHaveBeenCalled();

    expect(
      screen.getByText(
        "Process model awaiting analysis"
      )
    ).toBeInTheDocument();
  });

  /**
   * Confirms that valid requirements are sent to the analysis service and that
   * the returned process model replaces the empty-state output.
   */
  test("renders the returned process model after successful analysis", async () => {
    const user = userEvent.setup();

    analyzeRequirementsMock.mockResolvedValue({
      processName: "Refund Review Process",
      actors: [
        "Customer Service",
        "Manager",
      ],
      steps: [
        {
          id: "step-1",
          label: "Review refund request",
          description:
            "Customer service reviews the submitted refund request.",
          owner: "Customer Service",
          type: "start",
          connections: [
            {
              targetStepId: "step-2",
              label: "",
            },
          ],
        },
        {
          id: "step-2",
          label: "Approve high-value refund",
          description:
            "A manager approves refunds above the configured threshold.",
          owner: "Manager",
          type: "end",
          connections: [],
        },
      ],
      warnings: [],
    });

    render(<App />);

    const requirementsInput =
      screen.getByLabelText("Business Requirements");

    await user.type(
      requirementsInput,
      "Customer service reviews refund requests."
    );

    await user.click(
      screen.getByRole("button", {
        name: "Analyze Requirements",
      })
    );

    expect(
      analyzeRequirementsMock
    ).toHaveBeenCalledTimes(1);

    expect(
      analyzeRequirementsMock
    ).toHaveBeenCalledWith(
      "Customer service reviews refund requests."
    );

    expect(
      await screen.findByText(
        "Refund Review Process"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Review refund request"
      )
    ).toBeInTheDocument();

    expect(
      screen.getAllByText(
        "Approve high-value refund"
      )
    ).toHaveLength(2);

    expect(
      screen.queryByText(
        "Process model awaiting analysis"
      )
    ).not.toBeInTheDocument();
  });

  /**
 * Confirms that the submit control enters a disabled loading state while an
 * analysis request is still pending.
 */
test("shows and clears the analysis loading state", async () => {
  const user = userEvent.setup();

  let resolveAnalysis;

  analyzeRequirementsMock.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveAnalysis = resolve;
      })
  );

  render(<App />);

  await user.type(
    screen.getByLabelText("Business Requirements"),
    "Review customer refund requests."
  );

  await user.click(
    screen.getByRole("button", {
      name: "Analyze Requirements",
    })
  );

  expect(
    screen.getByRole("button", {
      name: "Analyzing...",
    })
  ).toBeDisabled();

  resolveAnalysis({
    processName: "Refund Review Process",
    actors: [
      "Customer Service",
    ],
    steps: [
      {
        id: "step-1",
        label: "Review refund request",
        description:
          "Customer service reviews the submitted request.",
        owner: "Customer Service",
        type: "end",
        connections: [],
      },
    ],
    warnings: [],
  });

  expect(
    await screen.findByRole("button", {
      name: "Analyze Requirements",
    })
  ).toBeEnabled();

  expect(
    screen.getByText("Refund Review Process")
  ).toBeInTheDocument();
});

/**
 * Confirms that the New Flow action clears entered requirements, returned
 * process data, and workspace errors before restoring the initial state.
 */
test("resets the completed workspace to its initial state", async () => {
  const user = userEvent.setup();

  analyzeRequirementsMock.mockResolvedValue({
    processName: "Refund Review Process",
    actors: [
      "Customer Service",
    ],
    steps: [
      {
        id: "step-1",
        label: "Review refund request",
        description:
          "Customer service reviews the submitted request.",
        owner: "Customer Service",
        type: "end",
        connections: [],
      },
    ],
    warnings: [],
  });

  render(<App />);

  const requirementsInput =
    screen.getByLabelText("Business Requirements");

  await user.type(
    requirementsInput,
    "Review customer refund requests."
  );

  await user.click(
    screen.getByRole("button", {
      name: "Analyze Requirements",
    })
  );

  expect(
    await screen.findByText("Refund Review Process")
  ).toBeInTheDocument();

  await user.click(
    screen.getByRole("button", {
      name: "New Flow",
    })
  );

  expect(requirementsInput).toHaveValue("");

  expect(
    screen.queryByText("Refund Review Process")
  ).not.toBeInTheDocument();

  expect(
    screen.getByText(
      "Process model awaiting analysis"
    )
  ).toBeInTheDocument();

  expect(
    screen.queryByRole("alert")
  ).not.toBeInTheDocument();
});

  /**
   * Confirms that analysis-service failures are surfaced through the workspace
   * error area and that the empty process state remains visible.
   */
  test("displays an analysis error returned by the service", async () => {
    const user = userEvent.setup();

    analyzeRequirementsMock.mockRejectedValue(
      new Error(
        "The analysis service is temporarily unavailable."
      )
    );

    render(<App />);

    await user.type(
      screen.getByLabelText("Business Requirements"),
      "Review customer refund requests."
    );

    await user.click(
      screen.getByRole("button", {
        name: "Analyze Requirements",
      })
    );

    expect(
      analyzeRequirementsMock
    ).toHaveBeenCalledTimes(1);

    expect(
      analyzeRequirementsMock
    ).toHaveBeenCalledWith(
      "Review customer refund requests."
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "The analysis service is temporarily unavailable."
    );

    expect(
      screen.getByText(
        "Process model awaiting analysis"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Analyze Requirements",
      })
    ).toBeEnabled();
  });
});