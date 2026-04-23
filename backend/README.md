# Miksir Backend 🏗️

> RESTful API powering the Miksir AI Concrete Mix Design SaaS platform.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Express.js (Node.js) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT, Google OAuth) |
| AI | Anthropic Claude API |
| Validation | Joi |
| PDF export | PDFKit |
| Logging | Winston |
| Rate limiting | express-rate-limit |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env template and fill in your keys
cp .env.example .env

# 3. Create tables in Supabase
#    Go to: Supabase Dashboard → SQL Editor → paste contents of schema.sql

# 4. Seed reference data (standards, exposure classes, code limits)
npm run seed

# 5. Start dev server
npm run dev

# Or production
npm start
```

---

## Project Structure

```
src/
├── index.js                  # Express app entry point
├── routes/
│   ├── auth.js               # /auth/* — signup, login, OAuth, password reset
│   ├── users.js              # /api/users/* — profile management
│   ├── chats.js              # /api/chats/* — chat & AI messaging
│   ├── designs.js            # /api/designs/* — mix design generation & export
│   └── standards.js          # /api/standards/* — reference data
├── middleware/
│   ├── auth.js               # JWT authentication middleware
│   ├── validation.js         # Joi schemas + validate() helper
│   └── errorHandler.js       # Global error & 404 handlers
├── services/
│   ├── aiService.js          # Claude API integration (sync + SSE streaming)
│   ├── mixDesignEngine.js    # ACI 211 9-step calculation engine
│   └── pdfService.js         # PDF report generation
├── data/
│   ├── standards.js          # Code standards reference data & lookup tables
│   └── seed.js               # Seeds reference tables into Supabase
└── utils/
    ├── logger.js             # Winston logger
    ├── response.js           # Consistent JSON response helpers
    └── supabase.js           # Supabase client (service role)
schema.sql                    # Run once in Supabase to create all tables + RLS
```

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/signup` | Register new user |
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/forgot-password` | Request password reset email |
| POST | `/auth/reset-password` | Reset password with token |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/google` | Get Google OAuth redirect URL |

### User Profile (requires Bearer token)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/users/profile` | Get own profile |
| PUT | `/api/users/profile` | Update profile / preferences |
| POST | `/api/users/change-password` | Change password |
| DELETE | `/api/users/profile` | Soft-delete account |

### Chats (requires Bearer token)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chats` | Create new chat |
| GET | `/api/chats` | List all chats (paginated) |
| GET | `/api/chats/:id` | Get chat + messages + latest design |
| PUT | `/api/chats/:id` | Rename chat |
| DELETE | `/api/chats/:id` | Delete chat |
| POST | `/api/chats/:id/messages` | Post user message |
| POST | `/api/chats/:id/ai-response` | Get AI response (stored) |
| POST | `/api/chats/:id/ai-response-stream` | Stream AI response (SSE) |

### Mix Design (requires Bearer token)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/designs/validate` | Pre-validate inputs, detect conflicts |
| POST | `/api/designs/generate` | Generate full ACI 211 mix design |
| GET | `/api/designs` | List design history (paginated) |
| GET | `/api/designs/:id` | Get single design |
| GET | `/api/designs/:id/export/pdf` | Download PDF report |
| GET | `/api/designs/:id/export/json` | Download JSON export |

### Standards Reference (public)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/standards` | List all supported standards |
| GET | `/api/standards/:id/exposure-classes` | Get exposure classes for a standard |
| GET | `/api/standards/:id/w-c-limits?exposure_class=XC3` | Get w/c and cement limits |

---

## Mix Design Engine

The calculation engine (`src/services/mixDesignEngine.js`) implements the **ACI 211.1 9-step procedure**:

1. **Slump** — maps slump to ACI water table bucket
2. **Max aggregate size** — from user input
3. **Water & air content** — Table 14.6 (non-air) / 14.7 (air-entrained)
4. **w/c ratio** — Table 14.8, then capped by EN 206/TS 500 durability limit
5. **Cement content** — `water ÷ w/c`
6. **Coarse aggregate** — Table 14.10 volume fractions × dry-rodded unit weight
7. **Fine aggregate** — fills remaining volume: `1 - (V_cement + V_water + V_CA + V_air)`
8. **Moisture adjustment** — adjusts all aggregate weights for field moisture vs. SSD
9. **Trial mix** — engine outputs QA notes and field tips for the trial

---

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Service role key (server-side only, never expose) |
| `CLAUDE_API_KEY` | Anthropic API key |
| `CLAUDE_MODEL` | Model name (default: `claude-sonnet-4-20250514`) |
| `JWT_SECRET` | Secret for JWT verification |
| `FRONTEND_URL` | Frontend base URL for CORS and OAuth redirects |
| `CORS_ORIGIN` | Comma-separated allowed origins |
| `PORT` | Server port (default: 3000) |

---

## Deployment

### Railway / Render / Fly.io
1. Set all environment variables from `.env.example`
2. Entry point: `npm start`
3. Build command: `npm install`

### Vercel (Node.js runtime)
Set `vercel.json`:
```json
{
  "builds": [{ "src": "src/index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/index.js" }]
}
```

---

## Security Notes

- All Claude API communication is backend-only — API key is never exposed to the frontend
- Passwords are managed by Supabase Auth (bcrypt)
- Row Level Security is enabled on all user-data tables
- Auth endpoints have stricter rate limiting (20 req/15 min)
- Soft-deletes only — no permanent data deletion on user request
- All errors are logged server-side with full stack; client receives generic messages
