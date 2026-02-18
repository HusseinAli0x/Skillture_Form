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
    type VARCHAR(50) NOT NULL,            -- text, textarea, select, radio, checkbox, number, email ...
    position INT NOT NULL,                -- Question order
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

-- Ensure unique position inside form
CREATE UNIQUE INDEX uq_form_fields_form_position
ON form_fields(form_id, position);

-- =====================================================
-- Table: responses
-- Represents a single form submission
-- =====================================================
CREATE TABLE responses (
    id UUID PRIMARY KEY,                  
    form_id UUID NOT NULL,                
    respondent JSONB,                     -- {"email": "...", "name": "..."} optional
    status SMALLINT DEFAULT 0,            -- 0=pending, 1=submitted, 2=reviewed
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
    field_type VARCHAR(50) DEFAULT 'text',-- Type of field for this answer
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

-- =====================================================
-- Indexes for performance
-- =====================================================
CREATE INDEX idx_form_fields_form_id ON form_fields(form_id);
CREATE INDEX idx_responses_form_id ON responses(form_id);
CREATE INDEX idx_response_answers_response_id ON response_answers(response_id);
CREATE INDEX idx_response_answers_field_id ON response_answers(field_id);
CREATE INDEX idx_response_answers_value ON response_answers USING GIN (value); -- JSONB search
CREATE INDEX idx_response_answer_vectors_embedding ON response_answer_vectors USING hnsw (embedding vector_cosine_ops); -- Vector similarity
