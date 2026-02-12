# Database Schema

The project uses PostgreSQL with the `pgvector` extension.

## Tables

### `admins`
System administrators who manage forms.
- `id` (UUID, PK)
- `username` (VARCHAR, Unique)
- `hashed_password` (TEXT)
- `created_at` (TIMESTAMP)

### `forms`
The core entity representing a questionnaire or survey.
- `id` (UUID, PK)
- `title` (JSONB): Multi-language title (e.g., `{"en": "Title", "ar": "العنوان"}`).
- `description` (JSONB): Multi-language description.
- `status` (SMALLINT): 1=Active, 0=Inactive/Closed.
- `created_at` (TIMESTAMP)

### `form_fields`
Questions or fields belonging to a form.
- `id` (UUID, PK)
- `form_id` (UUID, FK -> forms)
- `label` (JSONB): Question text.
- `type` (VARCHAR): e.g., `text`, `select`, `radio`, `checkbox`.
- `position` (INT): Sort order.
- `is_required` (BOOLEAN)
- `options` (JSONB): Array of options for select/radio fields.
- `placeholder/help_text` (JSONB)

### `responses`
A submission of a form by a user.
- `id` (UUID, PK)
- `form_id` (UUID, FK -> forms)
- `respondent` (JSONB): Metadata about the submitter (name, email, etc.).
- `submitted_at` (TIMESTAMP)

### `response_answers`
Individual answers to form fields.
- `id` (UUID, PK)
- `response_id` (UUID, FK -> responses)
- `field_id` (UUID, FK -> form_fields)
- `value` (JSONB): The stored answer content.

### `response_answer_vectors`
Embeddings for semantic search/AI analysis.
- `id` (UUID, PK)
- `response_answer_id` (UUID, FK -> response_answers)
- `embedding` (VECTOR(1536)): OpenAI compatible embedding.
- `model_name` (VARCHAR)

## Indexes
- standard B-tree indexes on foreign keys.
- **GIN index** on `response_answers(value)` for JSON search.
- **HNSW index** on `response_answer_vectors(embedding)` for fast vector similarity search.
