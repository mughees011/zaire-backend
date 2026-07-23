# ZAIRE — Backend API

> The neural core powering the ZAIRE AI assistant platform. Built on Node.js + Express, with a Python sidecar for agent execution and Engineer Mode's autonomous scaffolding pipeline.

[![Node.js](https://img.shields.io/badge/Node.js-24.x-brightgreen)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5.x-black)](https://expressjs.com)
[![License](https://img.shields.io/badge/License-MIT-blue)](#license)

---

## What is ZAIRE?

ZAIRE is a premium AI-powered HUD (Heads-Up Display) and developer assistant platform. This repository is the **backend** — the API and orchestration layer. The companion frontend (desktop app UI) lives in a separate repository.

The backend handles:

- **Chat & LLM routing** — Multi-provider AI (OpenAI, Groq, OpenRouter) with automatic failover and streaming responses
- **Engineer Mode** — Full pipeline from intake to architecture plan, design intelligence, scaffold generation, QA, repair, and export
- **Memory System** — Persistent context, task lists, and session management
- **License & Auth** — Clerk-based authentication and LemonSqueezy license enforcement
- **Security** — Helmet, rate limiting, secret scanning, and path traversal protection
- **Agent Daemon** — Python sidecar for computer-use and specialist agent features

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24.x |
| Framework | Express 5.x |
| Database | PostgreSQL (via `pg`) |
| Auth | Clerk (`@clerk/clerk-sdk-node`) |
| AI Providers | OpenAI, Groq, OpenRouter |
| Storage | AWS S3 (`@aws-sdk/client-s3`) |
| Payments | LemonSqueezy |
| Realtime | Socket.IO |
| Python Sidecar | FastAPI + asyncio |

---

## Getting Started

### Prerequisites

- Node.js ≥ 20
- Python ≥ 3.10
- A PostgreSQL database
- A Clerk account
- At least one LLM API key (OpenAI, Groq, or OpenRouter)

### 1. Clone & Install

```bash
git clone https://github.com/mughees011/zaire-backend.git
cd zaire-backend
npm install
pip install -r requirements.txt
```

### 2. Environment Variables

Create a `.env` file in the repository root:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/zaire

# Auth
CLERK_SECRET_KEY=sk_...
CLERK_PUBLISHABLE_KEY=pk_...

# AI Providers (at least one required)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...

# Storage (optional)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
AWS_REGION=us-east-1

# Payments (optional)
LEMON_SQUEEZY_API_KEY=...
LEMON_SQUEEZY_STORE_ID=...

# Google (optional — Drive/Calendar features)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
```

Never commit your real `.env` file — see [SECURITY.md](SECURITY.md).

### 3. Run Locally

```bash
# Start the Node.js backend
npm start

# In a separate terminal — start the Python agent sidecar
python agent_daemon.py
```

The server runs at `http://localhost:5000` by default.

---

## Project Structure

```
backend/
├── index.js                          # Main Express app and route definitions
├── agent_daemon.py                   # Python FastAPI sidecar (specialist agents)
├── services/
│   ├── engineer_workflow.js          # Engineer Mode scaffold generation and prompts
│   ├── engineer_scaffold_support.js  # API route and support file builders
│   ├── engineer_qa_repair.js         # QA, repair, export, and materialize logic
│   ├── design_intelligence.js        # Design Brief LLM prompts and narrative generation
│   └── ...
├── middleware/
│   └── license_enforcement.js        # License gate middleware
├── memory/
│   ├── chats/                        # Persisted chat sessions
│   └── tasks.json                    # Task memory
├── generated_projects/               # Materialized Engineer Mode project outputs
└── requirements.txt                  # Python dependencies
```

---

## Key API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/chat` | Main chat endpoint with streaming responses |
| `POST` | `/engineer/plan` | Generate an architecture plan from intake |
| `POST` | `/engineer/design-brief` | Generate a Design Intelligence brief |
| `POST` | `/engineer/design-brief/regenerate` | Regenerate the Design Intelligence brief |
| `POST` | `/engineer/scaffold` | Generate the full project scaffold |
| `POST` | `/engineer/qa` | Run QA checks against generated files |
| `POST` | `/engineer/repair` | AI-assisted repair for a reported error |
| `POST` | `/engineer/export` | Export the project as a ZIP |
| `POST` | `/engineer/materialize` | Write the project to disk and persist it |
| `GET`  | `/engineer/projects` | List all Engineer Mode projects for a user |
| `POST` | `/api/license/validate` | Validate a license key |

---

## Deployment

The backend is deployed on [Render](https://render.com).

```bash
# Build command
npm install

# Start command
node index.js
```

Set every environment variable listed above in your Render dashboard before deploying — the app will not start correctly without a valid database connection and at least one AI provider key.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, code style, and the pull request process.

## Security

See [SECURITY.md](SECURITY.md) for how to report a vulnerability.

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT — see [LICENSE](LICENSE).