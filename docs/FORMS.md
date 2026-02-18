# Forms Management

## Concept
The **Forms** module allows admins to create and manage surveys or questionnaires. A form serves as a container for questions (fields) and collects responses.

## Form Lifecycle
1. **Draft (Status 0)**: Initial state. Fields can be added/edited. Not visible to respondents.
2. **Active (Status 1)**: Published state. Ready to collect responses. Structure should be locked (conceptually).
3. **Closed (Status 2)**: No longer accepting responses.

## Data Structure
A Form entity consists of:
- **ID**: Unique identifier (UUID).
- **Title**: Name of the form.
- **Description**: Purpose or instructions.
- **Status**: Current state (Draft/Active/Closed).
- **CreatedAt**: Timestamp.

## Endpoints

### 1. Create Form
Creates a new form in **Draft** status.
- **URL**: `POST /api/v1/forms/`
- **Body**:
  ```json
  {
    "title": "Customer Feedback 2024",
    "description": "Annual survey for customer satisfaction."
  }
  ```
- **Response**: 201 Created.

### 2. List Forms
Retrieves all forms. Supports filtering.
- **URL**: `GET /api/v1/forms/?status=1` (Optional filters)
- **Response**: 200 OK with array of forms.

### 3. Get Form Details
Retrieves a single form by ID.
- **URL**: `GET /api/v1/forms/:id`
- **Response**: 200 OK.

### 4. Update Form
Updates title or description.
- **URL**: `PUT /api/v1/forms/:id`
- **Body**:
  ```json
  {
    "title": "Updated Title",
    "description": "Updated description"
  }
  ```
- **Response**: 200 OK.

### 5. Publish Form
Changes status to **Active**.
- **URL**: `POST /api/v1/forms/:id/publish`
- **Response**: 200 OK.

### 6. Close Form
Changes status to **Closed**.
- **URL**: `POST /api/v1/forms/:id/close`
- **Response**: 200 OK.

### 7. Delete Form
Removes a form and all associated fields/responses.
- **URL**: `DELETE /api/v1/forms/:id`
- **Response**: 204 No Content.

### 8. List Form Fields
Helper endpoint to get all fields belonging to a form.
- **URL**: `GET /api/v1/forms/:id/fields`
- **Response**: 200 OK with array of fields.

### 9. List Form Responses
Helper endpoint to get all responses for a form.
- **URL**: `GET /api/v1/forms/:id/responses`
- **Response**: 200 OK with array of responses.
