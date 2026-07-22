<div align="center">

# ZAIRE API

**The intelligent backend powering the ZAIRE AI platform.**

A scalable Node.js API responsible for AI orchestration, authentication, memory, conversations, tool execution, and real-time communication.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)
![Socket.io](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=for-the-badge&logo=socket.io)
![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge)

[Frontend Repository](https://github.com/yourusername/zaire-web) • [Report Bug](../../issues) • [Request Feature](../../issues)

</div>

---

# Overview

ZAIRE API is the backend service that powers the ZAIRE AI platform.

It handles authentication, AI requests, conversation management, memory persistence, real-time communication, and database operations through a modular and scalable architecture.

The API is designed with extensibility in mind, making it easy to integrate new AI models, tools, and services over time.

---

# Features

## AI Engine

- AI request processing
- Streaming responses
- Context-aware conversations
- Multi-model support
- Prompt management

## Authentication

- Secure authentication
- User sessions
- Protected API routes
- Token validation

## Memory

- Persistent chat history
- Context retrieval
- User memory management

## Database

- Supabase integration
- User management
- Conversation storage
- Message persistence

## Real-Time Communication

- Socket.IO support
- Live message streaming
- Connection management

## Security

- Environment-based configuration
- CORS protection
- Request validation
- Error handling
- Secure API endpoints

---

# Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| Database | Supabase |
| Authentication | Clerk |
| Realtime | Socket.IO |
| AI | Groq API |
| Language | JavaScript |
| Deployment | Railway |

---

# Project Structure

```text
zaire-api
│
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── sockets/
├── utils/
├── database/
├── public/
├── server.js
├── package.json
└── README.md
```

---

# Getting Started

## Clone the Repository

```bash
git clone https://github.com/yourusername/zaire-api.git

cd zaire-api
```

---

## Install Dependencies

```bash
npm install
```

---

## Environment Variables

Create a `.env` file.

```env
PORT=5000

NODE_ENV=development

JWT_SECRET=

GROQ_API_KEY=

SUPABASE_URL=

SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

CLERK_SECRET_KEY=

CLIENT_URL=http://localhost:3000
```

---

## Start Development Server

```bash
npm run dev
```

Production

```bash
npm start
```

---

# API Architecture

```
Client
   │
   ▼
Express Server
   │
   ├──────── Authentication
   │
   ├──────── AI Services
   │
   ├──────── Memory System
   │
   ├──────── Socket.IO
   │
   └──────── Database
                │
                ▼
           Supabase
```

---

# Main Responsibilities

- Authentication
- AI Request Processing
- Conversation Management
- Memory Persistence
- Database Operations
- File Handling
- Real-Time Messaging
- Tool Execution
- User Management

---

# Example Endpoints

| Method | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/chat` | Send a message to ZAIRE |
| GET | `/api/chat/history` | Retrieve chat history |
| GET | `/api/user` | Get current user |
| POST | `/api/auth/login` | User authentication |
| GET | `/api/health` | Health check |

> Update these routes to match your actual API before publishing.

---

# Deployment

ZAIRE API is deployment-ready and works well with platforms such as:

- Railway
- Render
- DigitalOcean
- VPS
- Docker

---

# Roadmap

## v0.1

- AI Chat
- Authentication
- Database
- Memory

## v0.2

- Tool Calling
- Streaming Responses
- Better Context Handling

## Future

- Multi-Agent Architecture
- Vision Support
- Voice Support
- Plugin System
- Workflow Automation
- External Integrations

---

# Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.

```bash
git checkout -b feature/new-feature
```

3. Commit your changes.

```bash
git commit -m "Add new feature"
```

4. Push to GitHub.

```bash
git push origin feature/new-feature
```

5. Open a Pull Request.

---

# Security

If you discover a security vulnerability, please report it privately instead of opening a public issue.

---

# License

Licensed under the Apache License 2.0.

See the LICENSE file for more information.

---

# Related Repositories

| Repository | Description |
|------------|-------------|
| ZAIRE Web | Frontend application |
| ZAIRE API | Backend services |

---

# Author

**Mughees Siddiqui**

GitHub: https://github.com/mughees011

LinkedIn: https://linkedin.com/in/mughees-siddiqui/

---

<div align="center">

## ZAIRE

**Building the future of intelligent AI experiences.**

If you found this project useful, consider giving it a ⭐ on GitHub.

</div>