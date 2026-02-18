# Skillture Form Frontend

This directory contains the React + Vite frontend for the Skillture Form application.

## Prerequisites

- Node.js (v18+)
- Backend server running on `http://localhost:8080`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

## Development

To start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.
All API requests to `/api` are proxied to the backend at `http://localhost:8080`.

## Building

To build for production:

```bash
npm run build
```

## Structure

- `src/layouts`: Admin and Public layouts.
- `src/pages`: Page components.
- `src/components/ui`: Reusable UI components (Button, Input, Card).
- `src/services`: API configuration.
