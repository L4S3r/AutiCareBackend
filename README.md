<div align="center">

<img src="https://img.shields.io/badge/AutiCare-Backend_API-6b9e78?style=for-the-badge&logoColor=white" height="40"/>

<h3>AutiCare — Backend API</h3>
<p>REST API and AI microservice powering the AutiCare platform.<br/>Built with Node.js · Express · MongoDB · FastAPI · Gemini AI</p>

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-AI_Microservice-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?style=flat-square&logo=vercel)](https://auti-care-backend.vercel.app)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**[Frontend Repo](https://github.com/L4S3r/AutiCareFrontend)** · **[Mobile App](https://github.com/L4S3r/AutiCareMobileApp)**

> [!NOTE]
> The Mobile App repository is private. Please contact [L4S3r](https://github.com/L4S3r) to request access.

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Security](#security)
- [Deployment](#deployment)

---

## Overview

AutiCare Backend is a serverless-compatible REST API built with Node.js and Express, deployed on Vercel. It handles authentication, user management, behavioral data, and coordinates with a separate FastAPI microservice that runs Gemini AI predictions for behavioral risk assessment.

MongoDB connections are cached per serverless instance to avoid cold-start connection storms — a critical optimization for Vercel's function-based deployment model.

---

## Architecture

```
                    ┌───────────────────────┐
                    │   Web (Next.js)        │
                    │   Mobile (Flutter)     │
                    └────────┬──────────────┘
                             │ HTTPS / REST
                             ▼
              ┌──────────────────────────────┐
              │     Node.js / Express API     │
              │     (Vercel Serverless)        │
              │                               │
              │  ┌───────────┐ ┌───────────┐  │
              │  │  Auth     │ │  RBAC     │  │
              │  │  (JWT)    │ │Middleware │  │
              │  └───────────┘ └───────────┘  │
              │                               │
              │  Controllers:                 │
              │  auth · admin · behavior ·    │
              │  nutrition · user             │
              └──────┬───────────────┬────────┘
                     │               │
              ┌──────▼──────┐ ┌──────▼───────────────┐
              │  MongoDB    │ │  FastAPI Microservice  │
              │  (Atlas)    │ │  Gemini AI Predictions │
              │             │ │  /predict · /analyze   │
              └─────────────┘ └────────────────────────┘
```

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | Node.js 20.x |
| Framework | Express 4.x |
| Database | MongoDB (Atlas) + Mongoose |
| Auth | JSON Web Tokens (JWT) |
| Password hashing | bcrypt |
| Rate limiting | express-rate-limit |
| CORS | cors (configured per environment) |
| AI Microservice | FastAPI + Gemini AI (Python) |
| API Docs | Swagger / OpenAPI (via FastAPI — gated in production) |
| Deployment | Vercel (serverless functions) |
| Config | dotenv + environment variables |

---

## Project Structure

```
AutiCareBackend/
├── api/
│   └── index.js              # Vercel serverless entry point
├── controllers/
│   ├── auth.controller.js    # Login, register, password reset
│   ├── admin.controller.js   # Admin user management
│   ├── behavior.controller.js# Behavioral log CRUD
│   ├── nutrition.controller.js
│   └── user.controller.js    # Profile management
├── middleware/
│   ├── auth.middleware.js    # JWT verification
│   └── role.middleware.js    # RBAC role checks
├── models/
│   ├── User.js               # User schema (multi-role)
│   ├── Behavior.js           # Behavioral event schema
│   ├── NutritionPlan.js
│   └── GeneticMarker.js
├── routes/
│   ├── auth.routes.js
│   ├── admin.routes.js
│   ├── behavior.routes.js
│   ├── nutrition.routes.js
│   └── user.routes.js
├── config/
│   └── db.js                 # MongoDB connection with serverless caching
├── ai-microservice/           # FastAPI Python service
│   ├── main.py               # FastAPI app
│   ├── predictor.py          # Gemini AI integration
│   ├── schemas.py            # Pydantic models
│   └── requirements.txt
├── vercel.json               # Vercel routing config
├── .env                      # Local env (git-ignored)
└── package.json
```

---

## API Reference

> ⚠️ **Base URL:** `https://auti-care-backend.vercel.app`
> All protected routes require `Authorization: Bearer <token>` header.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | ❌ | Register new user with role |
| `POST` | `/api/auth/login` | ❌ | Login and receive JWT |
| `POST` | `/api/auth/forgot-password` | ❌ | Trigger password reset email |
| `POST` | `/api/auth/reset-password` | ❌ | Reset password with token |
| `GET` | `/api/auth/me` | ✅ | Get current user profile |

### Users & Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/admin/users` | ✅ Admin | List all users |
| `PATCH` | `/api/admin/users/:id/role` | ✅ Admin | Update user role |
| `DELETE` | `/api/admin/users/:id` | ✅ Admin | Delete user |
| `PATCH` | `/api/users/profile` | ✅ | Update own profile |
| `PATCH` | `/api/users/profile/avatar` | ✅ | Update/clear personal profile photo |

### Child Profiles & Documents

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `PATCH` | `/api/patients/:id/avatar` | ✅ Parent/Admin | Update/clear child profile avatar |
| `POST` | `/api/patients/:id/birth-certificate` | ✅ Parent/Admin | Upload child birth certificate scan |

### Contact & Support

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/contact` | ❌ | Submit contact/help inquiry securely (saves to DB and notifies SMTP) |

### Behavioral Logs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/behavior` | ✅ | Log a behavioral event |
| `GET` | `/api/behavior/:childId` | ✅ | Get behavior history for child |
| `DELETE` | `/api/behavior/:id` | ✅ | Delete a log entry |

### AI Predictions (FastAPI Microservice)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/ai/predict` | ✅ | Behavioral risk prediction via Gemini AI |
| `GET` | `/ai/health` | ❌ | Microservice health check |

> 📝 Swagger UI is available in **development only** at `/ai/docs`. It is disabled in production to prevent API schema exposure.

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+ (for the AI microservice)
- MongoDB Atlas cluster (or local MongoDB)

### Installation

```bash
# Clone the repository
git clone https://github.com/L4S3r/AutiCareBackend.git
cd AutiCareBackend

# Install Node dependencies
npm install

# Install Python dependencies (AI microservice)
cd ../ai_microservice
pip install -r requirements.txt
cd ../AutiCareBackend

# Copy env template
cp .env.example .env
# Fill in your values
```

### Running locally

```bash
# Start the Express API
npm run dev

# In a separate terminal, start the FastAPI microservice
cd ../ai_microservice
uvicorn main:app --reload --port 8000
```

Express runs on `http://localhost:5000`, FastAPI on `http://localhost:8000`.

---

## Environment Variables

Create a `.env` file at the root. **Never commit this file.**

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/auticare

# JWT
JWT_SECRET=
JWT_EXPIRES_IN=7d

# Password Reset / SMTP
EMAIL_SERVICE=
EMAIL_USER=
EMAIL_PASS=
FROM_EMAIL=
COMPANY_EMAIL=                  # Optional company email address to receive contact form submissions
RESET_PASSWORD_URL=https://auti-care-frontend.vercel.app/reset-password

# AI Microservice
AI_SERVICE_URL=http://localhost:8000
GEMINI_API_KEY=

# Cloudinary Storage
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# CORS
ALLOWED_ORIGINS=https://auti-care-frontend.vercel.app,http://localhost:3000
```

---

## Security

| Measure | Implementation |
|---------|---------------|
| Authentication | JWT tokens — signed, expiring, verified on every protected route |
| Authorization | RBAC middleware — role checked after token verification |
| Password storage | bcrypt with salt rounds |
| Rate limiting | `express-rate-limit` on auth endpoints to prevent brute force |
| CORS | Explicit allowlist — only known origins accepted |
| Secrets | All secrets in environment variables — none in version control |
| File Security | Magic bytes signature validation checking MIME headers of all uploaded files (PNG, JPEG, GIF, WebP, PDF) |
| API docs | Swagger disabled in production — accessible in dev only |
| Trust proxy | Configured for Vercel's proxy layer (required for rate limiter accuracy) |

---

## Deployment

This API is deployed as a Vercel serverless function via `api/index.js`.

### Serverless MongoDB caching

To avoid a new MongoDB connection on every cold start, the connection is cached at the module level:

```js
// config/db.js
let cached = global.mongoose;
if (!cached) cached = global.mongoose = { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;
  // ... connect and cache
}
```

### Vercel configuration

```json
// vercel.json
{
  "rewrites": [{ "source": "/api/(.*)", "destination": "/api/index.js" }]
}
```

Set all environment variables in the **Vercel dashboard** under Project → Settings → Environment Variables.

---

## Recent Implementations & Features

### 1. Automated Layout-Aware PDF Parsing (AI Microservice)
- **FastAPI Endpoint (`/api/ai/parse-pdf`)**: Employs `pdfminer.six` for high-fidelity layout-aware text extraction from pediatric files, enabling deep semantic analysis by Gemini.
- **Dynamic Nutrition Integration**: Seamlessly maps clinical parameters directly to pediatric nutrigenomics plans, allowing automatic generation and loading of diets.

### 2. Multi-Role Administrator Override Gateways
- **Unified Directory Registry (`GET /api/admin/users`)**: Performs a concurrent, aggregated query thread across both the adult `User` and detached `ChildProfile` database collections to build a unified registry.
- **Direct Verify Bypass (`PUT /api/admin/users/:id/verify-bypass`)**: Admin gateway to manually bypass Firebase verification link issues and force activation (`isVerified: true`, `isActive: true`).
- **High-Entropy Password Mutation (`PUT /api/admin/users/:id/password`)**: Hashes new passwords with `bcrypt` (12 rounds) and commits changes directly across collections.

### 3. Cascading Profile Deletion Safeguards
- **Integrity Enforcement**: Deleting a caregiver/parent profile automatically executes a cascading delete pipeline targeting associated child profiles, logs, and compliance tables, preventing database rot.

---

## Related Repositories

| Repo | Description |
|------|-------------|
| [AutiCareFrontend](https://github.com/L4S3r/AutiCareFrontend) | Next.js web dashboard |
| [AutiCareMobileApp](https://github.com/L4S3r/AutiCareMobileApp) | Flutter mobile app (iOS & Android) - *Private repo: contact L4S3r for access* |
