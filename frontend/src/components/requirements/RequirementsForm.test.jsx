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

import { useState } from "react";

import {
  cleanup,
  render,
  screen,
} from "@testing-library/react";

import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import RequirementsForm from "./RequirementsForm";

// ========================================
// Component Test Cleanup
// ========================================

/**
 * Removes the rendered component after every test.
 *
 * Explicit cleanup keeps each test isolated and prevents later queries from
 * finding forms, inputs, or buttons created by previous test cases.
 */
afterEach(() => {
  cleanup();
});

// ========================================
// Requirements Form Test Helpers
// ========================================

/**
 * Renders the requirements form with reusable default properties.
 *
 * Individual tests can override only the values or handlers they need while
 * preserving a consistent baseline configuration.
 *
 * @param {object} overrides
 * Optional property overrides for the component.
 *
 * @returns {object}
 * Testing Library render result plus the resolved component properties.
 */
const renderRequirementsForm = (overrides = {}) => {
  const props = {
    requirements: "",
    onRequirementsChange: vi.fn(),
    onSubmit: vi.fn((event) => {
      event.preventDefault();
    }),
    isAnalyzing: false,
    ...overrides,
  };

  return {
    ...render(<RequirementsForm {...props} />),
    props,
  };
};

// ========================================
// Requirements Input Tests
// ========================================

describe("RequirementsForm", () => {
  /**
   * Confirms that the form renders its primary input and submit control with
   * the expected accessible labels.
   */
  test("renders the requirements input and submit button", () => {
    renderRequirementsForm();

    expect(
      screen.getByLabelText("Business Requirements")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: "Analyze Requirements",
      })
    ).toBeInTheDocument();
  });

  /**
 * Confirms that typing into the controlled textarea forwards the latest value
 * to the parent callback.
 *
 * A stateful wrapper mirrors the real parent behavior by storing each emitted
 * value and passing it back into the controlled component.
 */
test("reports requirements text changes to the parent", async () => {
  const user = userEvent.setup();
  const onRequirementsChange = vi.fn();

  const StatefulRequirementsForm = () => {
    const [
      requirements,
      setRequirements,
    ] = useState("");

    const handleRequirementsChange = (value) => {
      onRequirementsChange(value);
      setRequirements(value);
    };

    return (
      <RequirementsForm
        requirements={requirements}
        onRequirementsChange={handleRequirementsChange}
        onSubmit={(event) => {
          event.preventDefault();
        }}
        isAnalyzing={false}
      />
    );
  };

  render(<StatefulRequirementsForm />);

  const requirementsInput =
    screen.getByLabelText("Business Requirements");

  await user.type(
    requirementsInput,
    "Review vendor invoices."
  );

  expect(onRequirementsChange).toHaveBeenCalled();

  expect(
    onRequirementsChange
  ).toHaveBeenLastCalledWith(
    "Review vendor invoices."
  );

  expect(requirementsInput).toHaveValue(
    "Review vendor invoices."
  );
});

  /**
   * Confirms that submitting the form delegates the workflow to the parent
   * callback.
   */
  test("submits the requirements form through the parent handler", async () => {
    const user = userEvent.setup();

    const {
      props,
    } = renderRequirementsForm({
      requirements: "Review refund requests.",
    });

    await user.click(
      screen.getByRole("button", {
        name: "Analyze Requirements",
      })
    );

    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  /**
   * Confirms that the loading state disables repeated submissions and presents
   * clear progress text to the user.
   */
  test("disables submission while analysis is running", () => {
    renderRequirementsForm({
      isAnalyzing: true,
    });

    expect(
      screen.getByRole("button", {
        name: "Analyzing...",
      })
    ).toBeDisabled();
  });

  /**
   * Confirms that the form reflects the controlled requirements value supplied
   * by the parent component.
   */
  test("displays the current controlled requirements value", () => {
    renderRequirementsForm({
      requirements: "Review customer refund requests.",
    });

    expect(
      screen.getByLabelText("Business Requirements")
    ).toHaveValue(
      "Review customer refund requests."
    );
  });
});