# Skillture Platform

Skillture is a robust, highly scalable assessment platform for creating forms and real-time quiz games. This repository contains both the Go-based backend and the Vite + React + TypeScript frontend, fully containerized and ready for deployment.

## Architecture

The project is strictly separated into two environments:
- `/backend`: Go application using Gin framework, pgxpool, and Google Gemini API.
- `/frontend`: React SPA built with Vite, TypeScript, and Tailwind CSS.

## Prerequisites

- Docker and Docker Compose
- Node.js (v18+) for local frontend development
- Go (1.22+) for local backend development
- PostgreSQL (if running locally without Docker)

## Getting Started (Docker - Recommended)

1. **Clone the repository.**
2. **Environment Variables:**
   - Copy `backend/.env.example` to `backend/.env` and add your Google Gemini API Key:
     ```bash
     cp backend/.env.example backend/.env
     ```
     Ensure `GEMINI_API_KEY=your_key_here` is set in the `.env` file.
3. **Run Docker Compose:**
   ```bash
   docker-compose up --build -d
   ```
4. **Access the application:**
   - Public Homepage: [http://localhost:5173](http://localhost:5173)
   - Admin Dashboard: [http://localhost:5173/admin/dashboard](http://localhost:5173/admin/dashboard)
   - Backend API: [http://localhost:8080](http://localhost:8080)

## Default Admin Credentials

Upon the first startup, the database automatically seeds an initial admin account:
- **Username:** `admin`
- **Password:** `admin123`

*Please change these credentials in a production environment.*

## Local Development (Without Docker)

### Backend
1. Ensure PostgreSQL is running.
2. Initialize the database using `backend/internal/database/schema.sql`.
3. Navigate to `backend/` and run:
   ```bash
   go run cmd/api/main.go
   ```

### Frontend
1. Navigate to `frontend/`.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Features
- **Form Builder**: Create complex forms with multiple field types.
- **Quiz Game Builder**: Build engaging, time-limited live quizzes.
- **AI Analytics Panel**: Leverage Google Gemini 3.1 Pro to analyze form data and generate insights.
- **CMS Editor**: Customize the public-facing homepage and hero images effortlessly.
- **Share Modals**: Instantly generate QR codes and shareable links for forms.
