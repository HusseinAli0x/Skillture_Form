# API Documentation

Base URL: `/api/v1`

## Admins

### Create Admin
- **Endpoint**: `POST /admins/`
- **Request Body**:
  ```json
  {
    "username": "admin_user",
    "password": "secure_password"
  }
  ```
- **Response**: `201 Created` with Admin object.

### List Admins
- **Endpoint**: `GET /admins/`
- **Response**: `200 OK` with list of Admins.

### Get Admin
- **Endpoint**: `GET /admins/:id`
- **Response**: `200 OK` or `404 Not Found`.

### Delete Admin
- **Endpoint**: `DELETE /admins/:id`
- **Response**: `204 No Content`.

---

## Forms

### Create Form
- **Endpoint**: `POST /forms/`
- **Request Body**:
  ```json
  {
    "title": "{\"en\": \"My Survey\"}",
    "description": "{\"en\": \"Description here\"}"
  }
  ```
- **Response**: `201 Created`.

### List Forms
- **Endpoint**: `GET /forms/`
- **Response**: `200 OK`.

### Get Form
- **Endpoint**: `GET /forms/:id`
- **Response**: `200 OK`.

### Update Form
- **Endpoint**: `PUT /forms/:id`
- **Request Body**: Same as Create.
- **Response**: `200 OK`.

### Delete Form
- **Endpoint**: `DELETE /forms/:id`
- **Response**: `204 No Content`.

### Publish Form
- **Endpoint**: `POST /forms/:id/publish`
- **Response**: `200 OK`.

### Close Form
- **Endpoint**: `POST /forms/:id/close`
- **Response**: `200 OK`.

### List Form Fields
- **Endpoint**: `GET /forms/:id/fields`
- **Response**: `200 OK` with list of Fields.

### List Form Responses
- **Endpoint**: `GET /forms/:id/responses`
- **Response**: `200 OK` with list of Responses.

---

## Form Fields

### Create Field
- **Endpoint**: `POST /fields/`
- **Request Body**:
  ```json
  {
    "form_id": "uuid...",
    "label": {"en": "Question?"},
    "type": "text",
    "field_order": 1,
    "required": true,
    "options": {"en": ["Option 1", "Option 2"]}
  }
  ```
- **Response**: `201 Created`.

### Update Field
- **Endpoint**: `PUT /fields/:id`
- **Request Body**: Similar to Create (partial updates allowed).
- **Response**: `200 OK`.

### Delete Field
- **Endpoint**: `DELETE /fields/:id`
- **Response**: `204 No Content`.

---

## Responses

### Submit Response
- **Endpoint**: `POST /responses/`
- **Request Body**:
  ```json
  {
    "form_id": "uuid...",
    "respondent": {"name": "John Doe", "email": "john@example.com"},
    "answers": [
      {
        "field_id": "uuid...",
        "field_type": "text",
        "value": {"en": "Answer text"}
      }
    ]
  }
  ```
- **Response**: `201 Created`.

### Get Response
- **Endpoint**: `GET /responses/:id`
- **Response**: `200 OK`.

### Delete Response
- **Endpoint**: `DELETE /responses/:id`
- **Response**: `204 No Content`.
