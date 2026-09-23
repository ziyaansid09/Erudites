-- Reference migration for the initial PostgreSQL schema. The FastAPI service
-- applies this schema on startup for the simple local Docker workflow.
CREATE TABLE IF NOT EXISTS "user" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(120) NOT NULL,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS interview (
  id VARCHAR(36) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES "user"(id),
  config JSONB NOT NULL,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  report JSONB NULL
);
