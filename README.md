# Requirements Flow Agent

> Convert business requirements into structured process models that can be reviewed, edited, validated, and visualized.

The **Requirements Flow Agent** is a full-stack application that transforms business requirements into a structured workflow model.

## Current Capabilities

- React and Vite frontend deployed on Netlify
- Express backend deployed on Render
- OpenAI-powered requirements analysis
- Deterministic mock analysis for local development
- Token-free automated testing
- Structured process-model validation
- One controlled corrective retry for invalid AI output
- Request correlation through `X-Request-ID`
- Frontend and backend test suites
- GitHub Actions continuous integration

---

## Project Structure

```text
requirements-flow-agent/
├── .github/
│   └── workflows/
│       └── verify.yml
├── backend/
│   ├── src/
│   ├── test/
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
└── README.md
```

---

## Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| React | User interface |
| Vite | Development server and production build tooling |
| Vitest | Frontend automated testing |
| Netlify | Frontend deployment and hosting |

### Backend

| Technology | Purpose |
|---|---|
| Node.js 22 | Backend runtime |
| Express | API server |
| OpenAI SDK | AI-provider integration |
| Helmet | Security-related HTTP headers |
| CORS | Frontend-origin allowlisting |
| Express Rate Limit | Analysis endpoint rate limiting |
| Node Test Runner | Backend automated testing |
| Supertest | HTTP route integration testing |
| Render | Backend deployment and hosting |

### Continuous Integration

GitHub Actions runs the project verification workflow for:

- Pushes to `main`
- Pull requests targeting `main`

The workflow:

- Uses Node.js 22
- Installs dependencies with `npm ci`
- Runs the project verification command
- Cancels superseded workflow runs
- Enforces a 15-minute timeout

---

## Local Development

### Requirements

Install the following before running the project:

- Node.js 22
- npm 10 or newer

Locally verified versions:

```text
Node.js 22.18.0
npm 11.5.2
```

### Backend Setup

From the project root:

```bash
cd backend
npm install
```

Create the local backend environment file:

```bash
cp .env.example .env
```

Start the backend development server:

```bash
npm run dev
```

The backend uses port `3001` unless a different value is provided through the `PORT` environment variable.

#### Available Backend Commands

Start the backend with Nodemon:

```bash
npm run dev
```

Start the backend with Node.js:

```bash
npm start
```

Run the backend test suite:

```bash
npm test
```

### Frontend Setup

From the project root:

```bash
cd frontend
npm install
```

Create the local frontend environment file:

```bash
cp .env.example .env
```

Start the Vite development server:

```bash
npm run dev
```

---

## Analysis Modes

The backend supports two analysis modes.

### Mock Mode

```env
ANALYSIS_MODE=mock
```

Mock mode returns a deterministic process fixture and does not call an AI provider.

Use mock mode for:

- Local interface development
- Regression testing
- Editor testing
- Diagram testing
- Export testing
- Token-free verification

### AI Mode

```env
ANALYSIS_MODE=ai
AI_PROVIDER=openai
```

AI mode sends validated business requirements to the configured AI provider and converts the response into the application's process-model contract.

Provider credentials must remain server-side. They must never be stored in frontend environment variables or exposed to browser code.

---

## Automated Testing

### Backend Tests

Run the backend suite:

```bash
cd backend
npm test
```

Current backend result:

```text
67 passed
0 failed
```

Backend tests use deterministic fixtures and injected provider dependencies.

Routine tests do not:

- Contact OpenAI
- Require an API key
- Consume provider tokens
- Depend on an external AI service

### Project Verification

From the project root:

```bash
npm run verify
```

The same verification command runs in GitHub Actions.

---

## AI Response Reliability

The backend applies several safeguards before returning an AI-generated process model.

### Provider Reliability

- Configurable OpenAI request timeout
- Controlled provider retry behavior
- Safe provider-error classification
- Production-safe error propagation

### Response Validation

- Strict JSON parsing
- Required top-level process structure
- Exactly one start step
- At least one end step
- Duplicate step ID rejection
- Unknown connection target rejection
- Required step connection structure

### Corrective Retry

When the provider returns a response that cannot be parsed or validated:

1. The initial processing failure is classified.
2. A corrective prompt is generated.
3. Exactly one additional provider request is made.
4. The corrected response is validated through the same process contract.
5. The final result is returned or the last error is propagated.

The workflow never performs an unbounded retry loop.

---

## Request Correlation

Every API request receives a correlation identifier.

The request ID is:

- Read from a usable client-supplied `X-Request-ID` header
- Generated by the backend when no usable value is supplied
- Stored on `req.requestId`
- Returned through the `X-Request-ID` response header
- Passed from the controller into the analysis service
- Included in safe structured diagnostic events

### Correlated Events

```text
business_requirements_analysis_completed
business_requirements_analysis_failed
ai_process_correction_started
ai_process_correction_succeeded
ai_process_correction_failed
api_unhandled_error
```

### Logging Restrictions

The following data is intentionally excluded from diagnostic logs:

- Submitted requirements
- Full prompts
- Raw provider responses
- API keys
- Provider credentials

---

## Production Deployment

### Frontend Deployment

The frontend is deployed through Netlify.

The production frontend must be configured with the public Render backend URL.

### Backend Deployment

The backend is deployed through Render.

Current runtime configuration:

```text
Node.js: 22.18.0
NODE_VERSION: 22.18.0
```

The Express application enables `trust proxy` in production because Render forwards public requests through a reverse proxy.

This allows Express and Express Rate Limit to identify client addresses using forwarded request headers.

### Production Health Check

The backend exposes:

```http
GET /api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "Requirements Flow Agent API"
}
```

---

## Security and Logging

The backend currently includes:

- Helmet security headers
- Explicit CORS origin allowlisting
- JSON request-body size limits
- Analysis request rate limiting
- Production reverse-proxy support
- Safe client-facing error responses
- Request correlation middleware
- Structured success and failure logging
- Structured corrective-retry logging

Sensitive content must never be written to logs.

This includes:

- Business requirements
- Provider prompts
- Raw AI responses
- API keys
- Authentication secrets
- Provider credentials

---

## Current Reliability Status

Completed production-diagnostics work includes:

- OpenAI timeout configuration
- OpenAI retry configuration
- Safe provider-error classification
- Strict JSON validation
- Strict process-model validation
- Exactly one required start step
- At least one required end step
- Duplicate step ID rejection
- Unknown connection rejection
- One controlled corrective retry
- Structured corrective-retry logging
- Request-correlation middleware
- Generated request ID tests
- Client-supplied request ID tests
- Controller-to-service request-context propagation
- Correlation-specific service tests
- Correlation-specific controller tests
- Safe completion logging
- Node.js 22 alignment across local development, GitHub Actions, and Render
- Production request-correlation verification
- Render reverse-proxy configuration

---

## Current Test Status

```text
Backend:  67 passed
Frontend: 62 passed
Total:    129 passed
Failures: 0
```

---

## Roadmap

The next phase focuses on process-quality validation.

Planned improvements include:

- Detect unreachable steps
- Detect disconnected workflow sections
- Detect unexpected dead ends
- Verify that end steps are reachable
- Detect potentially unintended circular paths
- Validate decision steps for sufficient branches
- Detect duplicate or ambiguous branch labels
- Detect unused actors
- Add process-quality warnings instead of rejecting every imperfect model
- Surface warnings and validation problems in the editor
- Surface warnings and validation problems in the diagram

---

## Deployment Summary

| Component | Platform | Runtime |
|---|---|---|
| Frontend | Netlify | React and Vite |
| Backend | Render | Node.js 22.18.0 |
| AI Provider | OpenAI | Server-side integration |
| CI | GitHub Actions | Node.js 22 |

---

## Project Principles

The Requirements Flow Agent follows several implementation principles:

- Work in controlled, testable increments
- Keep routine tests token-free
- Keep AI-provider code behind service boundaries
- Validate all generated process data
- Avoid logging sensitive business content
- Preserve request traceability
- Prefer warnings for process-quality concerns
- Reject structurally unsafe process models
- Keep frontend and backend contracts stable