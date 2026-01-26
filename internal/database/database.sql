-- =====================================================
-- Enable pgvector extension (required for vector indexing)
-- =====================================================
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- Table: admins
-- Stores system administrators credentials
-- =====================================================
CREATE TABLE admins (
    id UUID PRIMARY KEY,                  -- Unique identifier for the admin
    username VARCHAR(255) NOT NULL UNIQUE,-- Admin login username
    hashed_password TEXT NOT NULL,        -- Securely hashed password
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Account creation time
);

-- =====================================================
-- Table: forms
-- Represents a form that users can submit
-- =====================================================
CREATE TABLE forms (
    id UUID PRIMARY KEY,                  -- Unique form identifier
    title VARCHAR(255) NOT NULL,          -- Form title
    description TEXT,                     -- Optional form description
    status SMALLINT DEFAULT 1,            -- Form status (e.g., active/inactive)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Creation timestamp
);

-- =====================================================
-- Table: form_fields
-- Defines fields/questions belonging to a form
-- =====================================================
CREATE TABLE form_fields (
    id UUID PRIMARY KEY,                  -- Unique field identifier
    form_id UUID NOT NULL,                -- Reference to parent form
    label TEXT NOT NULL,                  -- Field label/question text
    required BOOLEAN DEFAULT FALSE,       -- Whether the field is mandatory
    options JSONB,                        -- Options for select/checkbox fields
    field_order INTEGER DEFAULT 0,        -- Display order of the field
    type SMALLINT NOT NULL,               -- Field type (text, select, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_form_fields_form
        FOREIGN KEY (form_id)
        REFERENCES forms(id)
        ON DELETE CASCADE                 -- Delete fields when form is deleted
);

-- =====================================================
-- Table: responses
-- Represents a single form submission
-- =====================================================
CREATE TABLE responses (
    id UUID PRIMARY KEY,                  -- Unique response identifier
    form_id UUID NOT NULL,                -- Reference to the submitted form
    email VARCHAR(255),                   -- Optional respondent email
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_responses_form
        FOREIGN KEY (form_id)
        REFERENCES forms(id)
        ON DELETE CASCADE                 -- Delete responses if form is deleted
);

-- =====================================================
-- Table: response_answers
-- Stores answers for each field in a response
-- =====================================================
CREATE TABLE response_answers (
    id UUID PRIMARY KEY,                  -- Unique answer identifier
    response_id UUID NOT NULL,            -- Reference to response
    field_id UUID NOT NULL,               -- Reference to form field
    value JSONB NOT NULL,                 -- Answer value (supports any type)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_answers_response
        FOREIGN KEY (response_id)
        REFERENCES responses(id)
        ON DELETE CASCADE,                -- Delete answers if response is deleted
    CONSTRAINT fk_answers_field
        FOREIGN KEY (field_id)
        REFERENCES form_fields(id)
        ON DELETE CASCADE                 -- Delete answers if field is deleted
);

-- =====================================================
-- Table: response_answer_vectors
-- Stores vector embeddings for AI / semantic search
-- =====================================================
CREATE TABLE response_answer_vectors (
    id UUID PRIMARY KEY,                  -- Unique vector record ID
    response_answer_id UUID NOT NULL,     -- Reference to response_answers
    embedding vector(1536) NOT NULL,      -- Vector embedding (e.g. OpenAI)
    model_name VARCHAR(100),              -- Name of embedding model used
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vectors_answer
        FOREIGN KEY (response_answer_id)
        REFERENCES response_answers(id)
        ON DELETE CASCADE                 -- Delete vector if answer is deleted
);

-- =====================================================
-- Indexes for performance
-- =====================================================

-- Foreign key indexes
CREATE INDEX idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX idx_responses_form_id ON responses(form_id);
CREATE INDEX idx_response_answers_response_id ON response_answers(response_id);
CREATE INDEX idx_response_answers_field_id ON response_answers(field_id);

-- JSONB index for flexible querying inside answers
CREATE INDEX idx_response_answers_value
ON response_answers USING GIN (value);

-- Vector similarity search index (AI use cases)
CREATE INDEX idx_response_answer_vectors_embedding
ON response_answer_vectors
USING hnsw (embedding vector_cosine_ops);
