import {
  describe,
  expect,
  test,
} from "vitest";

import {
  createProcessDiagramLayout,
} from "../processDiagramLayoutUtils";

// ========================================
// Process Diagram Layout Tests
// ========================================

describe("createProcessDiagramLayout", () => {
  /**
   * Confirms that a simple sequential process is placed from left to right in
   * increasing columns while remaining on the same row.
   */
  test("places a sequential process from left to right", () => {
    const processModel = {
      steps: [
        {
          id: "step-1",
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
          type: "process",
          connections: [
            {
              targetStepId: "step-3",
              label: "",
            },
          ],
        },
        {
          id: "step-3",
          type: "end",
          connections: [],
        },
      ],
    };

    expect(
      createProcessDiagramLayout(processModel)
    ).toEqual({
      nodes: [
        {
          stepId: "step-1",
          column: 0,
          row: 0,
        },
        {
          stepId: "step-2",
          column: 1,
          row: 0,
        },
        {
          stepId: "step-3",
          column: 2,
          row: 0,
        },
      ],
      edges: [
        {
          sourceStepId: "step-1",
          targetStepId: "step-2",
          label: "",
        },
        {
          sourceStepId: "step-2",
          targetStepId: "step-3",
          label: "",
        },
      ],
    });
  });

    /**
     * Confirms that multiple outgoing branches are placed on separate rows while
     * remaining one column beyond the decision step.
     */
    test("places decision branches on separate rows", () => {
        const processModel = {
            steps: [
            {
                id: "step-1",
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
                type: "decision",
                connections: [
                {
                    targetStepId: "step-3",
                    label: "Yes",
                },
                {
                    targetStepId: "step-4",
                    label: "No",
                },
                ],
            },
            {
                id: "step-3",
                type: "process",
                connections: [],
            },
            {
                id: "step-4",
                type: "process",
                connections: [],
            },
            ],
        };

        expect(
            createProcessDiagramLayout(processModel)
        ).toEqual({
            nodes: [
            {
                stepId: "step-1",
                column: 0,
                row: 0,
            },
            {
                stepId: "step-2",
                column: 1,
                row: 0,
            },
            {
                stepId: "step-3",
                column: 2,
                row: 0,
            },
            {
                stepId: "step-4",
                column: 2,
                row: 1,
            },
            ],
            edges: [
            {
                sourceStepId: "step-1",
                targetStepId: "step-2",
                label: "",
            },
            {
                sourceStepId: "step-2",
                targetStepId: "step-3",
                label: "Yes",
            },
            {
                sourceStepId: "step-2",
                targetStepId: "step-4",
                label: "No",
            },
            ],
        });
    });

    /**
     * Confirms that steps continuing from a secondary branch remain on that
     * branch's row instead of collapsing back onto the primary path.
     */
    test("keeps branch continuation on the branch row", () => {
        const processModel = {
            steps: [
            {
                id: "step-1",
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
                type: "decision",
                connections: [
                {
                    targetStepId: "step-3",
                    label: "Yes",
                },
                {
                    targetStepId: "step-4",
                    label: "No",
                },
                ],
            },
            {
                id: "step-3",
                type: "end",
                connections: [],
            },
            {
                id: "step-4",
                type: "process",
                connections: [
                {
                    targetStepId: "step-5",
                    label: "",
                },
                ],
            },
            {
                id: "step-5",
                type: "end",
                connections: [],
            },
            ],
        };

        expect(
            createProcessDiagramLayout(processModel)
        ).toEqual({
            nodes: [
            {
                stepId: "step-1",
                column: 0,
                row: 0,
            },
            {
                stepId: "step-2",
                column: 1,
                row: 0,
            },
            {
                stepId: "step-3",
                column: 2,
                row: 0,
            },
            {
                stepId: "step-4",
                column: 2,
                row: 1,
            },
            {
                stepId: "step-5",
                column: 3,
                row: 1,
            },
            ],
            edges: [
            {
                sourceStepId: "step-1",
                targetStepId: "step-2",
                label: "",
            },
            {
                sourceStepId: "step-2",
                targetStepId: "step-3",
                label: "Yes",
            },
            {
                sourceStepId: "step-2",
                targetStepId: "step-4",
                label: "No",
            },
            {
                sourceStepId: "step-4",
                targetStepId: "step-5",
                label: "",
            },
            ],
        });
    });

    /**
     * Confirms that two decision branches can reconnect to one shared downstream
     * step without creating duplicate diagram nodes.
     */
    test("places a merged downstream step once after both branches", () => {
        const processModel = {
            steps: [
            {
                id: "step-1",
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
                type: "decision",
                connections: [
                {
                    targetStepId: "step-3",
                    label: "Yes",
                },
                {
                    targetStepId: "step-4",
                    label: "No",
                },
                ],
            },
            {
                id: "step-3",
                type: "process",
                connections: [
                {
                    targetStepId: "step-5",
                    label: "",
                },
                ],
            },
            {
                id: "step-4",
                type: "process",
                connections: [
                {
                    targetStepId: "step-5",
                    label: "",
                },
                ],
            },
            {
                id: "step-5",
                type: "end",
                connections: [],
            },
            ],
        };

        expect(
            createProcessDiagramLayout(processModel)
        ).toEqual({
            nodes: [
            {
                stepId: "step-1",
                column: 0,
                row: 0,
            },
            {
                stepId: "step-2",
                column: 1,
                row: 0,
            },
            {
                stepId: "step-3",
                column: 2,
                row: 0,
            },
            {
                stepId: "step-4",
                column: 2,
                row: 1,
            },
            {
                stepId: "step-5",
                column: 3,
                row: 0,
            },
            ],
            edges: [
            {
                sourceStepId: "step-1",
                targetStepId: "step-2",
                label: "",
            },
            {
                sourceStepId: "step-2",
                targetStepId: "step-3",
                label: "Yes",
            },
            {
                sourceStepId: "step-2",
                targetStepId: "step-4",
                label: "No",
            },
            {
                sourceStepId: "step-3",
                targetStepId: "step-5",
                label: "",
            },
            {
                sourceStepId: "step-4",
                targetStepId: "step-5",
                label: "",
            },
            ],
        });
    });

    /**
     * Confirms that nested decision branches receive unique grid positions instead
     * of placing separate process steps in the same column and row.
     */
    test("prevents nested decision branches from sharing a grid position", () => {
        const processModel = {
            steps: [
            {
                id: "step-1",
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
                type: "decision",
                connections: [
                {
                    targetStepId: "step-3",
                    label: "Yes",
                },
                {
                    targetStepId: "step-4",
                    label: "No",
                },
                ],
            },
            {
                id: "step-3",
                type: "decision",
                connections: [
                {
                    targetStepId: "step-5",
                    label: "Approved",
                },
                {
                    targetStepId: "step-6",
                    label: "Rejected",
                },
                ],
            },
            {
                id: "step-4",
                type: "process",
                connections: [
                {
                    targetStepId: "step-7",
                    label: "",
                },
                ],
            },
            {
                id: "step-5",
                type: "end",
                connections: [],
            },
            {
                id: "step-6",
                type: "end",
                connections: [],
            },
            {
                id: "step-7",
                type: "end",
                connections: [],
            },
            ],
        };

        const layout = createProcessDiagramLayout(processModel);

        const occupiedPositions = layout.nodes.map(
            (node) => `${node.column}:${node.row}`
        );

        expect(new Set(occupiedPositions).size).toBe(
            occupiedPositions.length
        );
    });

    /**
     * Confirms that steps outside the main start-connected flow are still placed in
     * unique positions after the primary diagram section.
     */
    test("places disconnected steps after the main workflow", () => {
        const processModel = {
            steps: [
            {
                id: "step-1",
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
                type: "end",
                connections: [],
            },
            {
                id: "step-3",
                type: "process",
                connections: [
                {
                    targetStepId: "step-4",
                    label: "",
                },
                ],
            },
            {
                id: "step-4",
                type: "end",
                connections: [],
            },
            ],
        };

        expect(
            createProcessDiagramLayout(processModel)
        ).toEqual({
            nodes: [
            {
                stepId: "step-1",
                column: 0,
                row: 0,
            },
            {
                stepId: "step-2",
                column: 1,
                row: 0,
            },
            {
                stepId: "step-3",
                column: 2,
                row: 0,
            },
            {
                stepId: "step-4",
                column: 3,
                row: 0,
            },
            ],
            edges: [
            {
                sourceStepId: "step-1",
                targetStepId: "step-2",
                label: "",
            },
            {
                sourceStepId: "step-3",
                targetStepId: "step-4",
                label: "",
            },
            ],
        });
    });

    /**
     * Confirms that a disconnected workflow section is laid out according to its
     * connections even when its steps are not stored in traversal order.
     */
    test("follows connections within a disconnected workflow section", () => {
        const processModel = {
            steps: [
            {
                id: "step-1",
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
                type: "end",
                connections: [],
            },
            {
                id: "step-4",
                type: "end",
                connections: [],
            },
            {
                id: "step-3",
                type: "process",
                connections: [
                {
                    targetStepId: "step-4",
                    label: "",
                },
                ],
            },
            ],
        };

        const layout = createProcessDiagramLayout(processModel);

        const disconnectedSource = layout.nodes.find(
            (node) => node.stepId === "step-3"
        );

        const disconnectedTarget = layout.nodes.find(
            (node) => node.stepId === "step-4"
        );

        expect(disconnectedTarget.column).toBe(
            disconnectedSource.column + 1
        );

        expect(disconnectedTarget.row).toBe(
            disconnectedSource.row
        );
    });
});