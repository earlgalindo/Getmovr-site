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
- **SQLite** via `sql.js` (SQLite compiled to WebAssembly) — file-based,
  parameterized queries throughout (`db.run/get/all`, all `?`-bound), and
  crucially no native module to compile and no Node-version requirement, so
  `npm install` works on any host regardless of build toolchain or Node
  version. Swappable for Postgres/MySQL later without changing the API
  shape. (Went through two earlier iterations — `better-sqlite3` failed to
  compile on Render's free-tier build image, and Node's built-in
  `node:sqlite` needed a newer Node than Render's build step actually used
  despite pinning attempts — `sql.js` sidesteps both problems entirely.)
  Since it operates on an in-memory image, every write persists itself back
  to `DB_PATH` immediately after (see `src/db.js`).
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

**Render (one click):** this repo includes `backend/render.yaml`. In the Render
dashboard, "New +" → "Blueprint" → point it at this GitHub repo, with Blueprint
Path set to `backend/render.yaml`. Render provisions a free web service and
generates a random `ADMIN_API_KEY` for you automatically (copy it from the
service's Environment tab afterward — you'll need it to log into `/admin`). No
Dockerfile or manual server setup required.

Render's free plan doesn't support persistent disks, so the SQLite file lives
on the service's ephemeral filesystem: it survives normal restarts but is
wiped on every redeploy. Fine for demoing the project; before using this for
a real client's live leads, either upgrade to a paid Render plan and mount
`DB_PATH` on a persistent disk (see the free-tier commit history in this repo
for the config), or point `DB_PATH` at a managed Postgres/SQLite host instead.

Once deployed, update `BACKEND_API_URL` near the top of the quote form's
`<script>` block in `index.html` (currently `/api/quotes`) to your Render
service's full URL, e.g. `https://movr-backend.onrender.com/api/quotes`, so the
live static site (wherever it's hosted) can reach the API.
