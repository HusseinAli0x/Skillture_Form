# Form Fields Management

## Concept
**Form Fields** represent the questions within a form. Each field has a specific type (e.g., Text, Select) and configuration options. Fields are linked to a specific Form ID.

## Supported Field Types
- **Text**: Single-line text input.
- **Textarea**: Multi-line text input.
- **Number**: Numeric input.
- **Email**: Email address input.
- **Select**: Dropdown menu (requires `options`).
- **Radio**: Single selection from a list (requires `options`).
- **Checkbox**: Multiple selection from a list (requires `options`).
- **Date**: Date picker.

## Data Structure
A FormField entity consists of:
- **ID**: Unique identifier (UUID).
- **FormID**: The ID of the parent form.
- **Label**: Multilingual map for the question text (e.g., `{"en": "What is your name?"}`).
- **Type**: Field type enum string.
- **Required**: Boolean indicating mandatory fields.
- **FieldOrder**: Integer for sorting questions.
- **Placeholder**: Multilingual map for placeholder text.
- **HelpText**: Multilingual map for additional instructions.
- **Options**: JSON object for Select/Radio/Checkbox types (e.g., `{"apple": "Apple", "banana": "Banana"}`).

## Endpoints

### 1. Create Field
Adds a new question to a form.
- **URL**: `POST /api/v1/fields/`
- **Body**:
  ```json
  {
    "form_id": "uuid_of_form",
    "label": {
      "en": "Preferred Contact Method"
    },
    "type": "Select",
    "field_order": 1,
    "required": true,
    "options": {
      "email": "Email",
      "phone": "Phone"
    }
  }
  ```
- **Response**: 201 Created.

### 2. Update Field
Modifies validation rules, labels, or options.
- **URL**: `PUT /api/v1/fields/:id`
- **Body**:
  ```json
  {
    "label": {
      "en": "Updated Question Label"
    },
    "required": false
  }
  ```
- **Response**: 200 OK.

### 3. Delete Field
Removes a question from a form.
- **URL**: `DELETE /api/v1/fields/:id`
- **Response**: 204 No Content.

### 4. List Fields by Form
Retrieves all questions for a specific form.
- **URL**: `GET /api/v1/forms/:form_id/fields` (Note: accessed via forms route)
- **Response**: 200 OK with array of fields.
