# The Erudites

A professional interview-practice platform for students. It includes password-based accounts, a 564-question structured seed bank, session history, rules-based content and delivery evaluation, browser microphone capture, optional Gemini transcription, resume extraction, reports, and a progress dashboard.

## Run locally

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`.

2. Add your Google AI Studio API key to `GEMINI_API_KEY` to enable Gemini transcription. Never commit the key. Without it, the interface offers transcript entry and uses the built-in rules-based evaluator.

3. Run:

   ```bash
   docker compose up --build
   ```

4. Open `http://localhost:5173`.

FastAPI documentation is available at:

`http://localhost:8000/docs`

## Frontend

The frontend uses Vite for development and production builds.

Vite provides:

* Fast development server
* Hot Module Replacement (HMR)
* Optimized production builds
* Modern JavaScript and TypeScript support
* Plugin-based frontend tooling

## Design notes

The seed questions live in:

```text
question-bank/questions.json
```

The `generate_bank.py` source is intentionally simple: add subject/topic entries or templates and rerun it to expand the bank without application-code changes.

Each question includes:

* Branch
* Subject
* Topic
* Question
* Difficulty
* Interview type
* Expected concepts
* Evaluation points

`database/001_initial.sql` documents the initial PostgreSQL migration. The API creates the initial local schema on startup, so Compose needs no additional database command.

## Voice and transcription

Voice recording uses the browser's `MediaRecorder` API.

Recordings are sent to Google Gemini only when `GEMINI_API_KEY` is configured in `.env`. Restart the API after changing the key.

If transcription fails:

* The audio is not erased client-side.
* The user can enter the transcript manually.
* The interview can continue using the manually supplied transcript.

## Interview evaluation

Each practice interview is limited to 10 questions.

The demo evaluator explicitly labels its output as **rules-based**. It calculates transparent rubric coverage and delivery metrics.

It does not infer:

* Accent
* Identity
* Intelligence
* Appearance
* Ethnicity
* Nationality
* Regional pronunciation

## Application architecture

The application consists of:

* **Frontend:** Vite-based web application
* **Backend:** FastAPI
* **Database:** PostgreSQL
* **Authentication:** Password-based accounts with JWT
* **Question bank:** Structured JSON seed data
* **Evaluation:** Rules-based scoring engine
* **Voice capture:** Browser `MediaRecorder`
* **Optional transcription:** Google Gemini
* **Resume processing:** Resume extraction pipeline
* **Reports:** Interview and progress reporting
* **Deployment:** Docker Compose

## Tests

The API is structured to run against PostgreSQL in Docker Compose.

Start the stack:

```bash
docker compose up --build
```

Then open:

```text
http://localhost:8000/docs
```

Use the FastAPI documentation to exercise:

* Registration
* Profile
* Interview
* Reporting
* Question bank
* Resume
* Transcription

## Development

For frontend development, the Vite development server provides fast startup and Hot Module Replacement.

For the complete application environment, use:

```bash
docker compose up --build
```

Do not commit `.env` or any API keys to the repository.
