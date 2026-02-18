# Response Management

## Concept
The **Responses** module collects answers submitted by users for specific forms. A single response contains respondent metadata and a collection of answers linked to form fields.

## Data Structure
A Response entity consists of:
- **ID**: Unique identifier (UUID).
- **FormID**: The ID of the form being answered.
- **Respondent**: JSON object containing user details (e.g., email, name).
- **Answers**: A collection of **ResponseAnswer** objects.
- **Status**: Current state (e.g., Pending, Submitted).
- **SubmittedAt**: Timestamp.

### ResponseAnswer Structure
- **FieldID**: The ID of the specific question being answered.
- **FieldType**: Type of the question.
- **Value**: JSON object storing the answer (supports multilingual structure if needed, e.g., `{"text": "John Doe"}`).

## Endpoints

### 1. Submit Response
Submits a filled-out form.
- **URL**: `POST /api/v1/responses/`
- **Body**:
  ```json
  {
    "form_id": "uuid_of_form",
    "respondent": {
      "email": "user@example.com",
      "name": "Jane Doe"
    },
    "answers": [
      {
        "field_id": "uuid_of_text_field",
        "field_type": "text",
        "value": {
          "text": "My answer here"
        }
      },
      {
        "field_id": "uuid_of_select_field",
        "field_type": "select",
        "value": {
          "selected": "option_key"
        }
      }
    ]
  }
  ```
- **Response**: 201 Created.

### 2. Get Response
Retrieves a specific submission.
- **URL**: `GET /api/v1/responses/:id`
- **Response**: 200 OK with full response details.

### 3. List Responses by Form
Retrieves all submissions for a specific form.
- **URL**: `GET /api/v1/forms/:form_id/responses`
- **Response**: 200 OK with array of responses.

### 4. Delete Response
Removes a submission from the system.
- **URL**: `DELETE /api/v1/responses/:id`
- **Response**: 204 No Content.
