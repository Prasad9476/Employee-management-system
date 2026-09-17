# EMS Pro

A multi-tenant Employee Management System (EMS) for SMBs — a scoped-down BambooHR /
Zoho People style system of record covering employees, departments, attendance,
leave, payroll, performance reviews, notifications, and audit logging.

## Stack

| Layer    | Tech                                                        |
| -------- | ----------------------------------------------------------- |
| Client   | React 19 + Vite + TypeScript, Tailwind CSS 4, React Query, Zustand |
| Server   | Node.js + Express 5 + TypeScript                            |
| Data     | Prisma ORM (SQLite for dev, PostgreSQL for Docker/prod)    |
| Validation | Zod                                                       |
| Auth     | JWT (short-lived access token) + httpOnly refresh-token cookie |

## Features

- **Multi-tenant** — every query is scoped to the caller's `tenantId`; a helper
  (`findTenantRecord`, `scopedEmployeeIds`) makes cross-tenant leaks structurally
  hard to introduce.
- **RBAC** — `Admin` / `HR` / `Manager` / `Employee` enforced at both the route
  (`authorize()`) and data (`scopedEmployeeIds`) layers.
- **Auth** — tenant-aware login, register, forgot/reset password, invite-based
  employee onboarding with a random one-time password + forced change on first login,
  refresh-token rotation, and logout with revocation.
- **Employees** — full lifecycle (candidate → probation → active → resigned/exit),
  per-employee profile with overview/attendance/leaves/payroll/performance/documents,
  search, and CSV export.
- **Employee Self-Service** — `/me` portal: own check-in/out, leave balance,
  salary slips, performance history, notifications.
- **Departments, Attendance, Leave** — check-in/out with late/overtime detection,
  leave balances as a first-class model, and an approve/reject workflow.
- **Payroll** — reusable `calculatePayroll` breakdown (basic, allowances, PF, ESI,
  tax, deductions, net) shared by the seeder and the API; PDF salary slips.
- **Performance** — score + category + comments per review.
- **Notifications** — in-app notifications with unread bell and mark-as-read.
- **Audit Log** — every mutating action is logged per tenant.
- **Security** — rate limiting on auth endpoints, Zod validation on write paths,
  file upload MIME/size checks with Cloudinary, secrets via env (never committed).

## Project layout

```
ems-pro/
├── client/          # React + Vite frontend
│   └── src/
│       ├── components/  # feature pages + shared ui kit (ui/index.tsx)
│       ├── hooks/       # React Query hooks wrapping the API
│       ├── api/axios.ts # axios instance w/ automatic refresh
│       └── App.tsx      # routing + role-gated routes
├── server/          # Express + Prisma backend
│   ├── src/
│   │   ├── controllers/  # request handling (parse / authorize / respond)
│   │   ├── services/     # business logic (payroll, attendance, notifications, email)
│   │   ├── middleware/   # auth, error handler
│   │   ├── validation/   # Zod schemas
│   │   └── lib/          # access, tokens, rate limit, pagination, dates
│   ├── prisma/schema.prisma
│   ├── prisma/seed.ts    # dev seed (wipes + repopulates)
│   └── tests/            # integration tests (auth, tenancy, rate limit)
└── docker-compose.yml    # Postgres + server + client (prod-ish)
```

## Getting started (local development)

### Prerequisites

- Node.js 20+
- npm

### 1. Server

```bash
cd server
npm install
cp .env.example .env      # DATABASE_URL defaults to SQLite (./dev.db)
npx prisma generate
npx prisma db push
npm run seed               # optional: load demo data
npm run dev                # http://localhost:4000
```

### 2. Client

```bash
cd client
npm install
cp .env.example .env       # VITE_API_URL=http://localhost:4000/api
npm run dev                # http://localhost:5173
```

### Demo seed accounts

The seed script (`npm run seed`) creates a tenant "Default Company" with:

| Role     | Email              | Password    |
| -------- | ------------------ | ----------- |
| Admin    | admin@ems.com      | admin123    |
| Manager  | manager@ems.com    | manager123  |
| HR       | hr@ems.com         | hr123       |

> These are **development-only** demo credentials created by a script that wipes
> the local DB. Employees added through the app are never assigned a fixed
> password — they get a random one-time password via an invite email and must
> change it on first login.

## Email delivery — Resend (with dev fallback)

Outbound email (`server/src/services/emailService.ts`) uses **Resend** for real
delivery when configured, and falls back to console logging in development:

- **Configured:** set `RESEND_API_KEY` (and optionally `EMAIL_FROM`) in
  `server/.env`. Invite and password-reset emails are then delivered for real.
- **Not configured:** emails are logged to the server console with an
  `[email:dev]` prefix instead of being delivered:

```
[email:dev] To=jane@acme.com | Subject=Welcome to EMS Pro — set your password
You have been added to EMS Pro. Use this invite link to set your password (valid for 7 days):
http://localhost:5173/reset-password?token=...&invite=1
```

The links they print are fully functional — they hit the real reset-password
endpoint — so the onboarding flow works in development. **For production, set
`RESEND_API_KEY`**; otherwise reset/invite tokens will never reach users, which
would lock them out of the invite/password-reset flow. This is the only
"known dev-only" gap in the auth flow.

## Environment variables

### Server (`server/.env`)

| Variable       | Description                                        |
| -------------- | -------------------------------------------------- |
| `DATABASE_URL` | Prisma connection string (SQLite for dev, Postgres in prod) |
| `JWT_SECRET`   | **Required.** Strong random secret used to sign JWTs. The server refuses to start without it. |
| `PORT`         | API port (default 4000)                            |
| `CLIENT_URL`   | Allowed CORS origin(s), comma-separated; also used as the base for reset/invite links |
| `COOKIE_SECURE`| `true` to mark the refresh cookie Secure (defaults to `NODE_ENV === 'production'`); set `false` over plain HTTP |
| `SMTP_URL`     | (Optional, planned) SMTP connection string for real email delivery |
| `RESEND_API_KEY` | (Optional) Resend API key. When set, invite/reset emails are delivered. Otherwise they log to the server console. |
| `EMAIL_FROM`   | (Optional) From address for outgoing email. Defaults to `EMS Pro <onboarding@resend.dev>`. |

### Client (`client/.env`)

| Variable         | Description                |
| ---------------- | -------------------------- |
| `VITE_API_URL`   | Base URL of the API. Default `/api` (Vite dev server proxies it to `localhost:4000`, nginx proxies it in prod). |

## Production / Docker

The included `docker-compose.yml` runs Postgres + server + client behind a single
origin (Nginx serves the static app on `:3000` and reverse-proxies `/api` to the
server, so there is no CORS and the httpOnly refresh cookie stays same-origin).

Deploy with:

```bash
cp .env.example .env      # then fill in every value
docker compose up -d --build
```

The stack **refuses to start** without `POSTGRES_PASSWORD` and `JWT_SECRET` (no
hardcoded defaults). On startup the server container waits for Postgres and
applies the Prisma schema automatically (`npx prisma db push`); no manual
migration step is required. The Postgres port is **not** published to the host.

### Required / important variables

| Variable            | Notes                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| `JWT_SECRET`        | Strong random secret (ideally `openssl rand -hex 32`). Required.       |
| `POSTGRES_PASSWORD` | DB password, interpolated into the server's `DATABASE_URL`. Required.  |
| `COOKIE_SECURE`     | `false` while on plain HTTP, `true` once TLS terminates in front.      |
| `CLIENT_URL`        | Public origin (e.g. `https://ems.example.com`); used in email links.   |
| `RESEND_API_KEY`    | **Set in production** — without it, invite/reset emails are only logged.|
| Cloudinary keys     | Required for avatar/resume/document uploads to work.                   |

The client image bakes `VITE_API_URL` at build time (default `/api`, see
`.env` → `VITE_API_URL` in compose build args). Change it only if the API is on
a separate origin.

> **Cookies over HTTPS.** When you serve the site over HTTPS set
> `COOKIE_SECURE=true`, otherwise browsers will refuse to store the refresh-token
> cookie and sessions will expire every ~15 minutes.

To use Postgres outside Docker, update `server/.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/ems_db
```

## Deploy to Render

A [`render.yaml`](./render.yaml) Blueprint deploys three resources with one click:

| Resource          | Type                          | What it runs                                  |
| ----------------- | ----------------------------- | --------------------------------------------- |
| `ems-pro-db`      | Managed PostgreSQL            | Database (schema applied automatically by the server at boot) |
| `ems-pro-api`     | Web service (Docker)          | Express API (`server/Dockerfile`, `/health` probe) |
| `ems-pro-web`     | Static site (CDN)             | Built Vite SPA from `client/`                  |

### 1. Push the project to GitHub

The app is not tracked in a repo yet — create one and push:

```bash
cd ems-pro
git init -b main
git add .
git commit -m "EMS Pro: Employee Management System"
git remote add origin git@github.com:<you>/ems-pro.git
git push -u origin main
```

### 2. Create the Blueprint

1. In the **Render Dashboard** go to **New > Blueprint**.
2. Connect your GitHub account and select the `ems-pro` repo (Branch: `main`).
3. Render finds `render.yaml` and asks for the `sync: false` secrets. Fill them in:

| Variable             | Value                                                                 |
| -------------------- | --------------------------------------------------------------------- |
| `JWT_SECRET`         | `openssl rand -hex 32` (or any strong random string). Required.       |
| `CLIENT_URL` (API)   | The static site URL, e.g. `https://ems-pro-web.onrender.com`. Used for CORS and email links. |
| `VITE_API_URL` (web) | The API URL, e.g. `https://ems-pro-api.onrender.com/api`. Baked into the client at build time. |
| Cloudinary keys      | Optional — only needed for avatar/resume/document uploads.            |
| `RESEND_API_KEY`     | Optional — without it, invite/reset emails are only logged to the server console. |

4. Click **Deploy Blueprint**.

> **Order matters.** The API usually reaches `Healthy` before the static site
> finishes its build. `VITE_API_URL` needs the API's public URL, so if you left
> it blank at creation, set it afterwards (**Environment** tab of the static
> site) and Redeploy the static site. Do the same for `CLIENT_URL` on the API
> if you missed it — then re-deploy from the API service's **Events** tab.

### Why cookies work cross-origin here

The SPA and the API get different `*.onrender.com` subdomains (different
*origins*, but the **same site**). The refresh-token cookie is
`httpOnly; SameSite=Lax; Secure` and host-only for the API subdomain, so the
browser still attaches it to `/api/*` requests — no CORS breaks, no third-party
cookie issues. The API's CORS is set from `CLIENT_URL` with `credentials: true`.

Keep both services on the same registrable domain:
- Same `*.onrender.com` subdomains — cookies work (this setup).
- A custom domain like `app.example.com` + `api.example.com` — still same-site, cookies work.
- Split across different domains (e.g. `example.com` + `api.other.com`) — **auth breaks**. Don't do that.

### Free-plan caveats (upgrade when ready)

- **Free web services sleep** after ~15 minutes of inactivity; the first request
  after a sleep takes some seconds to spin back up.
- **Free Postgres expires after 30 days.** Back up or upgrade to a paid plan
  before then (Render notifies you).
- **`prisma db push`** runs on every deploy to keep the schema in sync. For
  shared databases switch to `prisma migrate deploy` (see `docker-entrypoint.sh`).

## Configuration notes

- **SQLite vs Postgres.** The committed `schema.prisma` uses SQLite so the project
  runs zero-config in development and tests. For any shared/multi-user environment,
  switch the `provider` to `postgresql` and point `DATABASE_URL` at Postgres (see
  `docker-compose.yml`).
- **Uploads** are stored on Cloudinary (`server/.env`: Cloudinary keys). MIME types
  and a 5 MB size limit are enforced server-side.
- **Tests** run against a separate SQLite database (`prisma/test.db`) and are wiped
  before each suite.

## Testing

```bash
cd server
npm test        # Jest + supertest, integration tests
```

Covers authentication (login/password change/reset/invite), cross-tenant isolation
and RBAC boundaries, and rate limiting.

## Scripts

| Directory | Command       | Description                     |
| --------- | ------------- | ------------------------------- |
| server    | `npm run dev` | Start API (ts-node)             |
| server    | `npm test`    | Run integration tests           |
| server    | `npm run seed`| Load demo data (wipes DB)       |
| client    | `npm run dev` | Start Vite dev server           |
| client    | `npm run build`| Type-check + production build  |

## License

Internal / portfolio project.
