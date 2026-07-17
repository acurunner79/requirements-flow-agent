# Requirements Flow Agent Roadmap

- **Current phase:** Phase 3 — Diagram and visualization
- **Current item:** Add branch labels to decision connectors
- **Last completed item:** Draw process connectors
- **Backend test status:** 84 passed, 0 failed
- **Frontend test status:** 73 passed, 0 failed
## Resume Instructions

1. Read the **Current Status** section.
2. Continue only the first unchecked item in the current phase.
3. Work one controlled step at a time.
4. Add or update tests before moving to the next item.
5. Run the appropriate token-free test suite after each change.
6. Update this roadmap whenever an item is completed.

---

## Phase 1 — Finish Production Diagnostics

- [x] Propagate `requestId` into the AI workflow.
- [x] Include `requestId` in:
  - [x] `ai_process_correction_started`
  - [x] `ai_process_correction_succeeded`
  - [x] `ai_process_correction_failed`
- [x] Add correlation-specific service and controller tests.
- [x] Align local development, GitHub Actions, and Render on Node 22.
- [x] Perform a production request-correlation test.
- [x] Update backend and deployment documentation.

---

## Phase 2 — Process Quality and Validation

- [x] Detect unreachable steps.
- [x] Detect disconnected workflow sections.
- [x] Detect unexpected dead ends.
- [x] Verify that end steps are reachable.
- [x] Detect circular paths where they appear unintended.
- [x] Validate decision steps for sufficient branches.
- [x] Detect duplicate or ambiguous branch labels.
- [x] Detect unused actors.
- [x] Add process-quality warnings rather than rejecting every imperfect model.
- [x] Surface validation problems in the editor and diagram.

---

## Phase 3 — Diagram and Visualization

- [x] Improve automatic flow layout.
- [x] Add actor-based swimlanes.
- [x] Build the interactive process diagram preview.
- [x] Redesign the analyzed-process workspace for diagram and editor usability.
- [x] Draw process connectors.
- [ ] Render branch labels directly on connectors.
- [ ] Improve connector routing and arrowheads.
- [ ] Add pan and zoom.
- [ ] Add fit-to-screen.
- [ ] Improve navigation for large workflows.
- [ ] Synchronize diagram selection with the editor.
- [ ] Highlight warnings and validation problems visually.

---

## Phase 4 — Editing and Review Workflow

- [ ] Add drag-and-drop step reordering.
- [ ] Add visual connector creation.
- [ ] Add “insert step between” functionality.
- [ ] Add step duplication.
- [ ] Add bulk actor reassignment.
- [ ] Support branch editing from the diagram.
- [ ] Add undo and redo.
- [ ] Add autosave.
- [ ] Add keyboard shortcuts.
- [ ] Allow reviewers to accept or reject generated steps.
- [ ] Allow warnings to be marked resolved.
- [ ] Add reviewer notes.
- [ ] Track AI-generated versus user-edited content.
- [ ] Add review and approval statuses.
- [ ] Compare original AI output with the revised process.

---

## Phase 5 — Traceability

- [ ] Link process steps to their source requirements.
- [ ] Preserve requirement-to-actor relationships.
- [ ] Preserve requirement-to-warning relationships.
- [ ] Show which source text produced each diagram element.
- [ ] Add audit-friendly traceability exports.
- [ ] Track edits made after initial generation.

---

## Phase 6 — Export Improvements

- [ ] Generate native `.vsdx` files directly.
- [ ] Add swimlane-aware Visio output.
- [ ] Improve Visio shapes and connector routing.
- [ ] Position branch labels correctly.
- [ ] Add configurable page size and orientation.
- [ ] Add PDF export.
- [ ] Add PNG export.
- [ ] Add SVG export.
- [ ] Add a Word requirements-analysis report.
- [ ] Support reusable export templates.

---

## Phase 7 — Persistence and Project Management

- [ ] Add database persistence.
- [ ] Save and reopen projects.
- [ ] Add project names and descriptions.
- [ ] Duplicate projects.
- [ ] Archive projects.
- [ ] Restore archived projects.
- [ ] Add process-model versions.
- [ ] Add version comparison.
- [ ] Preserve export history.

---

## Phase 8 — Authentication and Collaboration

- [ ] Add user authentication.
- [ ] Add team or organization support.
- [ ] Add role-based access control.
- [ ] Share projects with other users.
- [ ] Add step-level comments.
- [ ] Add reviewer assignments.
- [ ] Add collaborative review.
- [ ] Add change history.
- [ ] Add approval history.

---

## Phase 9 — Expanded Inputs

- [ ] Import Word documents.
- [ ] Import PDFs.
- [ ] Import Excel requirement lists.
- [ ] Import user stories and acceptance criteria.
- [ ] Import meeting notes.
- [ ] Import policy and procedure documents.
- [ ] Support structured questionnaires.
- [ ] Potentially ingest relevant email content.

---

## Phase 10 — AI Enhancements

- [ ] Improve automatic decision branch labels.
- [ ] Detect missing Yes/No or Approved/Rejected outcomes.
- [ ] Detect missing exception paths.
- [ ] Add stronger warning classifications.
- [ ] Add provider-native structured output or JSON Schema enforcement.
- [ ] Track corrective-retry frequency.
- [ ] Track analysis duration.
- [ ] Log safe provider and model identifiers.
- [ ] Add configurable providers such as Anthropic, Azure OpenAI, or Ollama.
- [ ] Evaluate multi-pass analysis for complex requirements.

---

## Phase 11 — Alternative Delivery Options

- [ ] ChatGPT-based agent workflow.
- [ ] Microsoft Copilot Studio integration.
- [ ] Power Automate workflow.
- [ ] Microsoft Teams bot.
- [ ] Slack bot.
- [ ] Command-line version.
- [ ] Excel-based interface.
- [ ] Desktop application.
- [ ] Document or IDE extension.

---

## Decision Log

Use this section to record significant implementation decisions that affect future work.

### Entry Template

```txt
Date:
Phase:
Decision:
Reason:
Affected files:
Tests:
```