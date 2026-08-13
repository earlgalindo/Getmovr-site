# Movr Backend — Lead Capture & Booking Status API

A small REST API + SQLite database that replaces a no-code webhook (Make.com) with
a real, owned data store for a local service business's quote-request form. Built
as a companion to the static `getmovr.ca` marketing site in this repo.

## Why this exists

The site's "Get a Quote" form was posting straight to a Make.com webhook — leads
went out to email/automation but were never stored anywhere queryable. There was
no way to see how many requests came in, filter by service type, or track a lead
from "just submitted" through "booked." This backend adds that layer:

- Every quote request is persisted (name, phone, email, service type, preferred
  date, details, source, timestamps).
- A lightweight status workflow (`new → contacted → quoted → booked → closed`)
  with a notes/activity log per lead.
- A simple admin dashboard (`/admin`) to view and update leads without touching
  a database client.
- The existing form keeps working exactly as before — this is wired in as a
  non-blocking secondary write, so nothing breaks if the backend isn't deployed.

## Stack

- **Node.js + Express** — REST API
- **SQLite** (`better-sqlite3`) — zero-config, file-based, easy to inspect and
  deploy; swappable for Postgres/MySQL later without changing the API shape,
  since all access goes through parameterized `db.prepare()` calls.
- **Vanilla JS admin UI** — no framework/build step required.

## Data model

```
quotes
  id, name, phone, email, service, preferred_date, details, source,
  status (new|contacted|quoted|booked|closed), created_at, updated_at

quote_notes
  id, quote_id (FK -> quotes.id, ON DELETE CASCADE), note, created_at
```

## API

| Method | Path                    | Auth  | Purpose                              |
|--------|--------------------------|-------|---------------------------------------|
| POST   | `/api/quotes`            | none  | Create a lead (used by the site form) |
| GET    | `/api/quotes`            | admin | List leads, filter by `?status=`, paginate via `?limit&offset` |
| GET    | `/api/quotes/:id`        | admin | Get one lead + its notes              |
| PATCH  | `/api/quotes/:id`        | admin | Update status                         |
| POST   | `/api/quotes/:id/notes`  | admin | Add a note to a lead                  |
| GET    | `/api/health`            | none  | Health check                          |

Admin routes require an `x-api-key` header matching `ADMIN_API_KEY`.

## Running locally

```bash
cd backend
npm install
cp .env.example .env   # set a real ADMIN_API_KEY
npm start
```

The server serves the API, the admin dashboard at `/admin`, and the existing
static site (from the repo root) all from one process on `PORT` (default 3000).

## Testing

```bash
npm test
```

Runs an integration test suite (Node's built-in test runner) against a
throwaway SQLite file — covers input validation, auth enforcement, and the
create → list → update lifecycle.

## Deployment

Deploys as a normal Node process (Render, Railway, Fly.io, a small VPS, etc.).
Set `ADMIN_API_KEY` and, if you want the SQLite file to persist across deploys,
mount `DB_PATH` on a persistent volume.
