# Admin Management

## Concept
The **Admin** module manages system administrators who have privileged access to create, edit, and publish forms. Admins are authenticated via username and password.

## Data Structure
An Admin entity consists of:
- **ID**: Unique identifier (UUID).
- **Username**: Unique login name.
- **HashedPassword**: Securely stored password (never returned in API).
- **CreatedAt**: Timestamp of account creation.

## endpoints

### 1. Create Admin
Registers a new administrator.
- **URL**: `POST /api/v1/admins/`
- **Body**:
  ```json
  {
    "username": "admin_user",
    "password": "securepassword123"
  }
  ```
- **Response**: 201 Created with the created admin object (excluding password).

### 2. Login
Authenticates an admin.
- **URL**: `POST /api/v1/admins/login`
- **Body**:
  ```json
  {
    "username": "admin_user",
    "password": "securepassword123"
  }
  ```
- **Response**: 200 OK with admin ID and username (token support planned).

### 3. List Admins
Retrieves a list of all administrators.
- **URL**: `GET /api/v1/admins/`
- **Response**: 200 OK with an array of admin objects.

### 4. Get Admin by ID
Retrieves details of a specific admin.
- **URL**: `GET /api/v1/admins/:id`
- **Response**: 200 OK with admin object or 404 Not Found.

### 5. Delete Admin
Removes an administrator from the system.
- **URL**: `DELETE /api/v1/admins/:id`
- **Response**: 204 No Content.
