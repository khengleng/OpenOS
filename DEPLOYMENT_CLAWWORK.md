# Deploying ClawWork + OpenOS Platform

This guide explains how to deploy the integrated ClawWork AI Coworker platform.

## Architecture

1.  **Backend (ClawWork)**: A Python FastAPI service that manages AI agents and simulations.
    - Location: `external/ClawWork`
    - Dockerfile provided: `external/ClawWork/Dockerfile`
2.  **Frontend (OpenOS)**: The Next.js web portal that interfaces with the backend.
    - Location: `.` (Root)

## Deployment Steps (Railway)

### 1. Deploy the Backend (ClawWork)

1.  Create a **new service** on Railway from this GitHub repository.
2.  Configure the service:
    - **Root Directory**: `external/ClawWork`
    - **Builder**: Select "Dockerfile" (it should auto-detect `external/ClawWork/Dockerfile`).
3.  Set Environment Variables for the backend service:
    - `OPENAI_API_KEY`: Your OpenAI API key (Required).
    - `E2B_API_KEY`: Your E2B API key (Required for code execution).
    - `WEB_SEARCH_API_KEY`: Tavily or Jina API key (Optional).
    - `PYTHONUNBUFFERED`: `1`
4.  Detailed Configuration:
    - **Data Persistence**: The agents store data in `livebench/data`. This is ephemeral on Railway unless you mount a volume. For production, consider mounting a volume at `/app/livebench/data`.
    - **GDPVal Dataset**: The `gdpval` dataset is required. You may need to ensure it is present or download it during build/start if not included in the repo. (Note: OpenAI's GDPVal dataset is not included by default).

### 2. Deploy the Frontend (OpenOS)

1.  Deploy the root directory as a **Next.js** service.
2.  Set Environment Variables:
    - `NEXT_PUBLIC_CLAWWORK_API_URL`: The public URL of your deployed ClawWork backend (e.g., `https://clawwork-production.up.railway.app`).
    - Standard Next.js/Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, etc).

### 3. Usage

1.  Open your deployed OpenOS app.
2.  Navigate to the **Agents** tab in the sidebar.
3.  Click **Hire New Agent** to launch a simulation.
4.  Monitor your AI coworker's balance and activities in real-time.

## Local Development

1.  **Start Backend**:
    ```bash
    cd external/ClawWork
    source venv/bin/activate
    python livebench/api/server.py
    ```
    Runs on `http://localhost:8000`.

2.  **Start Frontend**:
    ```bash
    npm run dev
    ```
    Runs on `http://localhost:3000`.

3.  Navigate to `http://localhost:3000/agents`.
