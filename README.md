# PetroShield AI

PetroShield AI is an AI-powered command center that continuously monitors geopolitical risks affecting India's crude oil imports, simulates disruption scenarios, and generates executable procurement recommendations for policymakers and refinery operators.

## Project Structure

The project is structured as a full-stack application:

- **`backend/`**: FastAPI-based backend containing simulation engines, real-time WebSocket logic, and API routes.
- **`frontend/`**: Next.js 14 (App Router) frontend featuring a Map-first, dark-themed UI (Palantir/Bloomberg inspired).
- **`shared/`**: Contains shared models or configurations (if any).
- **`docs/`**: Project documentation and architecture diagrams.

## How to Install

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/petroshield-ai.git
   cd petroshield-ai
   ```

2. **Frontend Dependencies**:
   ```bash
   cd frontend
   npm install
   ```

3. **Backend Dependencies**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   pip install -r requirements.txt
   ```

## Environment Setup

1. Copy `.env.example` to `.env` in both the `frontend` and `backend` directories.
2. Fill in the required configuration variables.
3. The platform runs in Demo Mode by default and relies on synthetic JSON data located in `backend/data/`. No external API keys are required for the demo.

## How to Run Backend

```bash
cd backend
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The API documentation (Swagger UI) will be available at `http://localhost:8000/docs`.

## How to Run Frontend

```bash
cd frontend
npm run dev
```
The Command Center dashboard will be available at `http://localhost:3000`.

## Folder Overview

- `backend/services/`: Core calculation engines (Risk, Scenario, Procurement, SPR, Knowledge Graph).
- `backend/data/`: Mock JSON data simulating realistic global energy supply chains.
- `backend/routes/`: FastAPI endpoint definitions.
- `frontend/app/`: Next.js App Router pages (Dashboard, Login).
- `frontend/components/`: Reusable React components (Layouts, KPICards, Maps).
- `frontend/services/`: Axios API clients for interacting with the backend.
