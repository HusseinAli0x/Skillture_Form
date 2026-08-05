-- =====================================================
-- Enable pgvector extension (required for vector indexing)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- Table: admins
-- Stores system administrators credentials
-- =====================================================
CREATE TABLE admins (
    id UUID PRIMARY KEY,                  
    username VARCHAR(255) NOT NULL UNIQUE, -- Admin login username
    hashed_password TEXT NOT NULL,        -- Securely hashed password
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Account creation time
);

-- =====================================================
-- Table: forms
-- Represents a form that users can submit
-- =====================================================
CREATE TABLE forms (
    id UUID PRIMARY KEY,                  
    title JSONB NOT NULL,                 -- {"en": "Survey", "ar": "استبيان"}
    description JSONB,                    -- Optional description in multiple languages
    status SMALLINT DEFAULT 1,            -- Form status (1=active, 0=inactive)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Table: form_fields
-- Defines fields/questions belonging to a form
-- =====================================================
CREATE TABLE form_fields (
    id UUID PRIMARY KEY,
    form_id UUID NOT NULL,

    label JSONB NOT NULL,                 -- {"en": "Name", "ar": "الاسم"}
    type SMALLINT NOT NULL,               -- 1=text, 2=textarea, 3=number, 4=email, 5=select, 6=radio, 7=checkbox, 8=date
    field_order INT NOT NULL,             -- Question order
    is_required BOOLEAN NOT NULL DEFAULT false,
    placeholder JSONB,                    -- {"en": "...", "ar": "..."} optional
    help_text JSONB,                      -- {"en": "...", "ar": "..."} optional
    options JSONB,                        -- {"en":["Option1","Option2"], "ar":["خيار1","خيار2"]}
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_form_fields_form
        FOREIGN KEY (form_id)
        REFERENCES forms(id)
        ON DELETE CASCADE
);

// UNIQUE INDEX REMOVED to allow reordering without constraint violations

-- =====================================================
-- Table: responses
-- Represents a single form submission
-- =====================================================
CREATE TABLE responses (
    id UUID PRIMARY KEY,                  
    form_id UUID NOT NULL,                
    respondent JSONB,                     -- {"email": "...", "name": "..."} optional
    status SMALLINT NOT NULL DEFAULT 1,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_responses_form
        FOREIGN KEY (form_id)
        REFERENCES forms(id)
        ON DELETE CASCADE
);

-- =====================================================
-- Table: response_answers
-- Stores answers for each field in a response
-- =====================================================
CREATE TABLE response_answers (
    id UUID PRIMARY KEY,                  
    response_id UUID NOT NULL,            
    field_id UUID NOT NULL,               
    field_type SMALLINT NOT NULL DEFAULT 1,
    value JSONB NOT NULL,                 -- {"en": "John", "ar": "جون"} for multi-language answers
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_answers_response
        FOREIGN KEY (response_id)
        REFERENCES responses(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_answers_field
        FOREIGN KEY (field_id)
        REFERENCES form_fields(id)
        ON DELETE CASCADE
);

-- =====================================================
-- Table: response_answer_vectors
-- Stores vector embeddings for AI / semantic search
-- =====================================================
CREATE TABLE response_answer_vectors (
    id UUID PRIMARY KEY,                  
    response_answer_id UUID NOT NULL,     
    embedding vector(1536) NOT NULL,      -- Vector embedding (e.g. OpenAI)
    model_name VARCHAR(100),              
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_vectors_answer
        FOREIGN KEY (response_answer_id)
        REFERENCES response_answers(id)
        ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX idx_responses_form_id ON responses(form_id);
CREATE INDEX idx_response_answers_response_id ON response_answers(response_id);
CREATE INDEX idx_response_answers_field_id ON response_answers(field_id);
CREATE INDEX idx_response_answers_value ON response_answers USING GIN (value); -- JSONB search
CREATE INDEX idx_response_answer_vectors_embedding ON response_answer_vectors USING hnsw (embedding vector_cosine_ops); -- Vector similarity

-- =====================================================
-- QUIZ MODULE SCHEMA
-- Migration: Add real-time interactive quiz game tables
-- =====================================================

-- =====================================================
-- Table: quizzes
-- =====================================================
CREATE TABLE quizzes (
    id          UUID PRIMARY KEY,
    title       JSONB NOT NULL,
    description JSONB,
    status      SMALLINT NOT NULL DEFAULT 1,             -- 0=draft, 1=active, 2=archived
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Table: quiz_questions
-- =====================================================
CREATE TABLE quiz_questions (
    id             UUID PRIMARY KEY,
    quiz_id        UUID NOT NULL,

    question       JSONB NOT NULL,
    type           VARCHAR(20) NOT NULL,                 -- mcq | tf | short
    position       INT NOT NULL,
    time_limit_sec INT NOT NULL DEFAULT 15,
    points         INT NOT NULL DEFAULT 1000,

    options        JSONB,
    correct_answer JSONB NOT NULL,

    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_quiz_questions_quiz
        FOREIGN KEY (quiz_id)
        REFERENCES quizzes(id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_quiz_questions_position ON quiz_questions(quiz_id, position);
CREATE INDEX idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);

-- =====================================================
-- Table: quiz_sessions
-- =====================================================
CREATE TABLE quiz_sessions (
    id                  UUID PRIMARY KEY,
    quiz_id             UUID NOT NULL,
    host_id             UUID NOT NULL,

    pin                 VARCHAR(10) NOT NULL UNIQUE,
    status              VARCHAR(20) NOT NULL DEFAULT 'lobby',

    current_question_id UUID,

    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at          TIMESTAMP,
    finished_at         TIMESTAMP,

    CONSTRAINT fk_quiz_sessions_quiz
        FOREIGN KEY (quiz_id)
        REFERENCES quizzes(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_quiz_sessions_host
        FOREIGN KEY (host_id)
        REFERENCES admins(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_quiz_sessions_current_question
        FOREIGN KEY (current_question_id)
        REFERENCES quiz_questions(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_quiz_sessions_quiz_id ON quiz_sessions(quiz_id);
CREATE INDEX idx_quiz_sessions_pin     ON quiz_sessions(pin);
CREATE INDEX idx_quiz_sessions_status  ON quiz_sessions(status);

-- =====================================================
-- Table: quiz_players
-- =====================================================
CREATE TABLE quiz_players (
    id         UUID PRIMARY KEY,
    session_id UUID         NOT NULL,
    name       VARCHAR(255) NOT NULL,
    score      INT          NOT NULL DEFAULT 0,
    joined_at  TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_quiz_players_session
        FOREIGN KEY (session_id)
        REFERENCES quiz_sessions(id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX uq_quiz_players_session_name ON quiz_players(session_id, name);
CREATE INDEX idx_quiz_players_session_id ON quiz_players(session_id);

-- =====================================================
-- Table: quiz_player_answers
-- =====================================================
CREATE TABLE quiz_player_answers (
    id            UUID PRIMARY KEY,
    player_id     UUID      NOT NULL,
    session_id    UUID      NOT NULL,
    question_id   UUID      NOT NULL,

    answer        JSONB     NOT NULL,
    is_correct    BOOLEAN   NOT NULL,
    score_awarded INT       NOT NULL DEFAULT 0,
    time_taken_ms INT       NOT NULL,

    answered_at   TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_player_question_answer UNIQUE (player_id, question_id),

    CONSTRAINT fk_quiz_answers_player
        FOREIGN KEY (player_id)
        REFERENCES quiz_players(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_quiz_answers_session
        FOREIGN KEY (session_id)
        REFERENCES quiz_sessions(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_quiz_answers_question
        FOREIGN KEY (question_id)
        REFERENCES quiz_questions(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_quiz_player_answers_player_id   ON quiz_player_answers(player_id);
CREATE INDEX idx_quiz_player_answers_session_id  ON quiz_player_answers(session_id);
CREATE INDEX idx_quiz_player_answers_question_id ON quiz_player_answers(question_id);

-- =====================================================
-- Table: homepage_content
-- =====================================================
CREATE TABLE homepage_content (
  id SERIAL PRIMARY KEY,
  hero_title TEXT NOT NULL DEFAULT 'Build Smarter Assessments',
  hero_subtitle TEXT,
  cta_primary_text TEXT DEFAULT 'Get Started',
  cta_secondary_text TEXT DEFAULT 'Learn More',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default homepage content
INSERT INTO homepage_content (id, hero_title, hero_subtitle, cta_primary_text, cta_secondary_text)
VALUES (1, 'Build Smarter Assessments', 'Create forms and live quizzes that engage your audience seamlessly.', 'Get Started', 'Learn More')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Table: homepage_images
-- =====================================================
CREATE TABLE homepage_images (
  id UUID PRIMARY KEY,
  file_path TEXT NOT NULL,
  alt_text TEXT,
  is_active BOOLEAN DEFAULT true,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- Initial Seed
-- =====================================================
-- Insert default admin account (Password: Skillture@2025)
INSERT INTO admins (id, username, hashed_password)
SELECT gen_random_uuid(), 'admin', '$2a$10$32rK7q4Q1E.Tj4tH1eH84.1w0P3K7P/O5s1g8pS6gq2p/Yw.1w52K'
WHERE NOT EXISTS (SELECT 1 FROM admins);
