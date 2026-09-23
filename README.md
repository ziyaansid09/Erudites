# The Erudites

A professional interview-practice platform for students. It includes password-based accounts, a 564-question structured seed bank, session history, rules-based content/delivery evaluation, browser microphone capture, optional Gemini transcription, resume extraction, reports, and a progress dashboard.

## Run locally

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET`.
2. Add your Google AI Studio API key to `GEMINI_API_KEY` to enable Gemini transcription. Never commit the key. Without it, the interface offers transcript entry and uses the built-in rules-based evaluator.
3. Run `docker compose up --build`.
4. Open `http://localhost:5173`; FastAPI documentation is at `http://localhost:8000/docs`.

## Design notes

The seed questions live in `question-bank/questions.json`. The `generate_bank.py` source is intentionally simple: add subject/topic entries or templates and rerun it to expand the bank without application-code changes. Each item includes branch, subject, topic, question, difficulty, interview type, expected concepts, and evaluation points. `database/001_initial.sql` documents the initial PostgreSQL migration; the API creates the initial local schema on startup so Compose needs no extra command.

Voice recording uses the browser's `MediaRecorder`. Recordings are sent to Google Gemini only when `GEMINI_API_KEY` is configured in `.env`; restart the API after changing it. A failed transcription does not erase audio client-side and users can enter a transcript themselves. Each practice interview is limited to 10 questions. The demo evaluator labels its output as rules-based; it calculates transparent rubric coverage plus delivery metrics. It does not infer accent, identity, intelligence, appearance, ethnicity, nationality, or regional pronunciation.

## Tests

The API is structured to run against PostgreSQL in Compose. Start the stack and check `/docs` to exercise registration, profile, interview, reporting, question bank, resume, and transcription routes.
