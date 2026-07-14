# Requirements Flow Agent Testing Guide

## Purpose

This guide defines how to test the Requirements Flow Agent without unnecessarily consuming paid AI-provider tokens.

Routine interface, validation, editing, and export testing should use mock mode. Live AI mode should be reserved for changes that specifically affect provider communication, prompt quality, provider adapters, or provider-response handling.

---

## Analysis Modes

The backend supports two analysis modes.

### Mock Mode

```env
ANALYSIS_MODE=mock
```

Mock mode returns the reusable **Vendor Invoice Review** fixture without contacting an AI provider.

Use mock mode for:

- Frontend layout testing
- Process-name editing
- Actor editing
- Step editing
- Connection editing
- Connector-label testing
- Validation testing
- JSON export testing
- Visio workbook testing
- Workspace reset testing
- General regression testing

Mock mode does not consume AI-provider tokens.

### AI Mode

```env
ANALYSIS_MODE=ai
```

AI mode sends the submitted requirements to the centrally configured provider.

Use AI mode only for:

- Testing prompt changes
- Testing provider adapters
- Verifying model configuration
- Evaluating AI-generated process quality
- Testing provider-specific response behavior
- Confirming live credential and network configuration

AI mode may incur provider charges.

---

## Recommended Local Testing Workflow

### 1. Enable Mock Mode

Update the backend environment configuration:

```env
ANALYSIS_MODE=mock
```

Restart the backend after changing the environment value.

### 2. Submit Requirements

Enter any non-empty requirements text.

Mock mode does not analyze the submitted text. The text is retained only as `sourceText` for traceability.

The backend should return the reusable **Vendor Invoice Review** fixture.

### 3. Run the Regression Checklist

Verify:

1. The process contains 10 steps.
2. Decision steps contain labeled branches.
3. The process name can be edited.
4. Actors can be added, renamed, and removed.
5. Step descriptions, types, and owners can be edited.
6. Outgoing connections can be added, edited, and removed.
7. Connector labels remain synchronized with their target steps.
8. Validation updates immediately after changes.
9. JSON export contains the edited `connections` data.
10. Visio export contains connector labels.
11. Visio export does not contain duplicate rows.
12. End steps contain no outgoing targets.
13. **New Flow** resets the workspace.
14. Submitting again reloads an unchanged fixture.

---

## Connection Data Contract

Rich connection objects are the authoritative outgoing-path structure:

```json
{
  "connections": [
    {
      "targetStepId": "STEP-008",
      "label": "No"
    },
    {
      "targetStepId": "STEP-009",
      "label": "Yes"
    }
  ]
}
```


with:

```md
`connections` is the authoritative outgoing-path structure used throughout the application.

Each connection contains:

- `targetStepId`
- `label`

The application does not generate or store a separate identifier-only connection mirror.

The backend still accepts legacy provider responses containing `nextStepIds` and converts them into unlabeled rich connection objects during normalization.
```


The compatibility property should be removed only after every backend and frontend module has been confirmed to use `connections`.

---

## Testing Backend Normalization Without API Calls

Backend response normalization should be tested with hard-coded provider-response strings rather than live provider requests.

A test response can include:

```json
{
  "processName": "Approval Process",
  "actors": ["Requester", "Manager"],
  "steps": [
    {
      "id": "STEP-001",
      "type": "start",
      "label": "Request submitted",
      "owner": "Requester",
      "connections": [
        {
          "targetStepId": "STEP-002",
          "label": ""
        }
      ]
    },
    {
      "id": "STEP-002",
      "type": "decision",
      "label": "Is the request approved?",
      "owner": "Manager",
      "connections": [
        {
          "targetStepId": "STEP-003",
          "label": "Yes"
        },
        {
          "targetStepId": "STEP-004",
          "label": "No"
        }
      ]
    }
  ],
  "warnings": []
}
```

Pass the serialized response directly into:

```js
processAiResponse(responseText);
```

This verifies parsing and normalization without contacting an external provider.

---

## Token-Free End-to-End Regression Test

Run this regression test with:

```env
ANALYSIS_MODE=mock
```

### Analysis

1. Submit any non-empty requirements text.
2. Confirm the **Vendor Invoice Review** fixture loads.
3. Confirm the process contains 10 steps.
4. Confirm multiple actors are present.
5. Confirm decision steps contain labeled outgoing branches.

### Editing

Verify that the following values can be changed:

- Process name
- Actor name
- Step description
- Step type
- Step owner
- Connection target
- Connector label

Also verify:

- An outgoing connection can be removed.
- A removed connection can be re-added.
- Decision labels remain associated with the correct target steps.
- End steps cannot retain outgoing paths after saving.

### Validation

Verify that validation updates immediately after each edit.

Test the following conditions:

- Missing process name
- Missing actors
- Missing step ID
- Duplicate step ID
- Missing step description
- Missing step owner
- Unassigned owner
- Unsupported step type
- Missing start step
- Multiple start steps
- Missing end step
- Invalid connection target
- Missing connection target
- Duplicate outgoing connection
- Self-referencing connection
- Decision with fewer than two branches
- Decision branch without a connector label
- Non-end step without an outgoing connection
- End step with an outgoing connection

The validation section should remain compact by default and allow users to expand the complete issue list.

### JSON Export

Export the process model as JSON and verify:

- The edited process name is present.
- Edited actors are present.
- Edited step data is present.
- Rich `connections` objects are present.
- Connector labels are preserved.
- No legacy `nextStepIds` properties are present.
- End steps contain empty connection arrays.

### Visio Workbook Export

Export the Visio-ready Excel workbook and verify:

- The workbook downloads successfully.
- The process worksheet is present.
- No duplicate rows are generated.
- Process step IDs are present.
- Step descriptions are present.
- **Next Step ID** values match connection targets.
- **Connector Label** values contain decision labels.
- **Shape Type** values are present.
- **Function** values match step owners.
- End steps contain an empty **Next Step ID**.
- End steps contain an empty **Connector Label**.
- The **Outgoing Connection Count** is correct.
- Workbook instructions describe connector-label mapping correctly.

### Workspace Reset

1. Click **New Flow**.
2. Confirm the requirements input resets.
3. Confirm the process review panel resets.
4. Confirm validation results are cleared.
5. Submit requirements again.
6. Confirm the original fixture reloads unchanged.

This final check confirms that frontend edits do not mutate the shared backend fixture.

---

## Fixture-Based Testing

The reusable mock fixture is stored at:

```text
backend/src/fixtures/complexProcessModel.js
```

The fixture should include:

- Multiple actors
- Standard process steps
- Multiple decision steps
- Labeled branches
- At least one process loop
- A start step
- An end step
- A warning
- Rich `connections`
- No legacy connection-mirror properties

The fixture is returned through:

```text
backend/src/services/requirementsAnalysisService.js
```

The fixture must be cloned before returning it:

```js
const mockProcessModel = structuredClone(
  complexProcessModelFixture
);
```

This prevents frontend edits from mutating the shared object stored in Node's module cache.

---

## Live AI Verification Checklist

Before enabling AI mode, confirm that the change specifically requires a provider request.

Then set:

```env
ANALYSIS_MODE=ai
```

Verify:

- `AI_PROVIDER` is configured.
- The selected provider credential is available server-side.
- The model environment variable is configured.
- No credentials are exposed to the frontend.
- The provider request succeeds.
- The returned JSON is valid.
- The response is normalized correctly.
- Rich `connections` are preserved.
- Decision labels are preserved.
- The normalized response does not expose `nextStepIds`.
- Provider warnings are surfaced.
- Token usage is limited to the minimum number of requests required.

Return to mock mode after live verification:

```env
ANALYSIS_MODE=mock
```

---

## When a Live Provider Call Is Justified

A live provider call is appropriate when testing:

- Prompt wording
- Prompt response quality
- Provider SDK integration
- Provider authentication
- Model selection
- Token-limit behavior
- Provider-specific response formatting
- Provider error handling
- Model-generated decision labels
- Model-generated warnings
- Provider network connectivity

A live provider call is not required for:

- CSS changes
- Layout changes
- Component changes
- Form validation
- Process editing
- Connection editing
- JSON export
- Visio export
- Reset behavior
- Validation-summary presentation
- Utility refactoring
- Workbook styling

---

## API Credential Safety

AI-provider credentials must remain in backend environment variables.

Do not:

- Store provider credentials in frontend code.
- Commit `.env` files.
- Include credentials in fixtures.
- Include credentials in exported process files.
- Log credentials to the terminal.
- Return credentials in API responses.
- Ask analysts to configure provider keys in the browser.

The backend is responsible for centrally configured provider access.

Analysts should be able to submit requirements without knowing which provider credentials or models are configured.

---

## Provider Architecture

The requirements-analysis service should remain provider-neutral.

```text
Controller
  ↓
Requirements Analysis Service
  ↓
Provider Router
  ↓
Configured Provider Adapter
  ↓
OpenAI, Anthropic, Azure OpenAI, Ollama, or another provider
```

Provider credentials and model configuration remain server-side.

Potential providers include:

- OpenAI
- Anthropic Claude
- Azure OpenAI
- Ollama
- Other approved enterprise providers

Changing providers should not require changes to:

- Frontend components
- API routes
- Controllers
- Validation
- Export utilities

Only the provider configuration or provider adapter should need to change.

---

## ChatGPT Plus and API Usage

A ChatGPT Plus subscription does not include general OpenAI API usage.

The application uses provider API credentials configured separately on the backend.

Live API requests may therefore incur usage charges even when the developer has a ChatGPT Plus subscription.

Mock mode should remain the default testing path whenever a live provider response is not required.

---

## Accepted Dependency Risk

The frontend currently uses ExcelJS for Visio-ready workbook generation.

A package audit reported a moderate transitive dependency issue involving `uuid`.

The dependency was not force-downgraded because doing so could introduce compatibility or workbook-generation regressions.

Until the upstream dependency is resolved:

- Keep ExcelJS updated through normal compatible releases.
- Re-run package audits after dependency upgrades.
- Do not use forced dependency resolutions without regression testing.
- Do not use `npm audit fix --force` without reviewing every proposed change.
- Verify workbook generation after dependency changes.
- Record any change to the accepted risk in project documentation.
- Reassess the risk before production deployment.

---

## Recommended Package Audit Workflow

Run:

```bash
npm audit
```

Review:

- Vulnerability severity
- Direct versus transitive dependency
- Whether a compatible package update exists
- Whether the vulnerable code path is used by the application
- Whether the proposed fix introduces breaking changes

After a dependency update, rerun:

```bash
npm install
npm audit
npm run build
```

Then repeat the token-free regression checklist.

---

## Regression Test Record

Use the following template when documenting a regression run:

```md
## Regression Test Record

**Date:** YYYY-MM-DD  
**Tester:** Name  
**Analysis Mode:** mock  
**Frontend Build:** Passed / Failed  
**Backend Start:** Passed / Failed  

### Analysis

- Fixture loaded: Passed / Failed
- Process contains 10 steps: Passed / Failed
- Decision labels present: Passed / Failed

### Editing

- Process name editing: Passed / Failed
- Actor editing: Passed / Failed
- Step editing: Passed / Failed
- Connection editing: Passed / Failed

### Validation

- Validation updates immediately: Passed / Failed
- Collapsed validation layout: Passed / Failed
- Expanded issue list: Passed / Failed

### Exports

- JSON export: Passed / Failed
- Visio export: Passed / Failed
- Connector labels: Passed / Failed
- Duplicate rows absent: Passed / Failed

### Reset

- New Flow reset: Passed / Failed
- Fixture reloaded unchanged: Passed / Failed

### Notes

Document any defects, warnings, accepted risks, or follow-up work.
```

---

## Testing Principle

Use the least expensive testing path that proves the change.

Mock fixtures should be the default.

Hard-coded provider responses should be used for backend parsing and normalization tests.

Live provider calls should be deliberate, limited, and documented.