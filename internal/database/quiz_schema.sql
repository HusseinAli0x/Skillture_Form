-- =====================================================
-- QUIZ MODULE SCHEMA
-- Migration: Add real-time interactive quiz game tables
-- =====================================================

-- =====================================================
-- Table: quizzes
-- Represents a quiz created in the dashboard
-- =====================================================
CREATE TABLE quizzes (
    id          UUID PRIMARY KEY,
    title       JSONB NOT NULL,                          -- {"en": "Tech Quiz", "ar": "اختبار تقني"}
    description JSONB,                                   -- Optional multilingual description
    status      SMALLINT NOT NULL DEFAULT 1,             -- 0=draft, 1=active, 2=archived
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Table: quiz_questions
-- Defines questions belonging to a quiz.
-- All content (question text, options, correct answer)
-- is stored as JSONB for multilingual flexibility.
-- =====================================================
CREATE TABLE quiz_questions (
    id             UUID PRIMARY KEY,
    quiz_id        UUID NOT NULL,

    question       JSONB NOT NULL,                       -- {"en": "What is Go?", "ar": "ما هو Go؟"}
    type           VARCHAR(20) NOT NULL,                 -- mcq | tf | short
    position       INT NOT NULL,                         -- Display/play order within the quiz
    time_limit_sec INT NOT NULL DEFAULT 15,              -- Seconds allowed to answer
    points         INT NOT NULL DEFAULT 1000,            -- Max base points for this question

    options        JSONB,                                -- {"en":["Go","Java"], "ar":["غو","جافا"]} — MCQ/TF only
    correct_answer JSONB NOT NULL,                       -- {"en":"Go"} or {"value":true} or {"text":"..."}

    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_quiz_questions_quiz
        FOREIGN KEY (quiz_id)
        REFERENCES quizzes(id)
        ON DELETE CASCADE
);

-- Each question has a unique position within its quiz
CREATE UNIQUE INDEX uq_quiz_questions_position
    ON quiz_questions(quiz_id, position);

CREATE INDEX idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);

-- =====================================================
-- Table: quiz_sessions
-- Represents a single live game session for a quiz.
-- One quiz can have many sessions over time.
-- =====================================================
CREATE TABLE quiz_sessions (
    id                  UUID PRIMARY KEY,
    quiz_id             UUID NOT NULL,
    host_id             UUID NOT NULL,                   -- The admin hosting this session

    pin                 VARCHAR(10) NOT NULL UNIQUE,     -- 6-digit numeric PIN for players to join
    status              VARCHAR(20) NOT NULL DEFAULT 'lobby', -- lobby | active | finished

    current_question_id UUID,                            -- Tracks which question is live right now

    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at          TIMESTAMP,                       -- When host pressed "Start Game"
    finished_at         TIMESTAMP,                       -- When the last question was answered

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
-- Tracks every player who joined a live session.
-- Identified by nickname (no auth required for players).
-- =====================================================
CREATE TABLE quiz_players (
    id         UUID PRIMARY KEY,
    session_id UUID         NOT NULL,
    name       VARCHAR(255) NOT NULL,                    -- Player's chosen nickname
    score      INT          NOT NULL DEFAULT 0,          -- Cumulative score across all questions
    joined_at  TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_quiz_players_session
        FOREIGN KEY (session_id)
        REFERENCES quiz_sessions(id)
        ON DELETE CASCADE
);

-- A player's nickname must be unique within the same session
CREATE UNIQUE INDEX uq_quiz_players_session_name
    ON quiz_players(session_id, name);

CREATE INDEX idx_quiz_players_session_id ON quiz_players(session_id);

-- =====================================================
-- Table: quiz_player_answers
-- Records each answer a player submits during a session.
-- score_awarded is calculated server-side based on
-- accuracy and time_taken_ms (speed-based scoring).
-- =====================================================
CREATE TABLE quiz_player_answers (
    id            UUID PRIMARY KEY,
    player_id     UUID      NOT NULL,
    session_id    UUID      NOT NULL,
    question_id   UUID      NOT NULL,

    answer        JSONB     NOT NULL,                    -- The player's submitted answer payload
    is_correct    BOOLEAN   NOT NULL,
    score_awarded INT       NOT NULL DEFAULT 0,          -- Points earned (accuracy + speed bonus)
    time_taken_ms INT       NOT NULL,                    -- Response time in milliseconds

    answered_at   TIMESTAMP NOT NULL DEFAULT NOW(),

    -- Prevent a player from answering the same question twice
    CONSTRAINT uq_player_question_answer
        UNIQUE (player_id, question_id),

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
