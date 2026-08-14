const path = require('path');
const express = require('express');
const db = require('./src/db');
const quotesRouter = require('./src/routes/quotes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// The marketing site is served from a static host (getmovr.ca on Vercel) while
// this API runs elsewhere, so the quote form posts cross-origin. A JSON POST is
// not a "simple" request, so the browser sends a preflight first — without these
// headers it is rejected and leads silently never reach the database.
// Restricted to known origins rather than "*", so another site can't point its
// own form at this endpoint.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  'https://getmovr.ca,https://www.getmovr.ca')
  .split(',').map((o) => o.trim()).filter(Boolean);

app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    res.set('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/quotes', quotesRouter);

// Admin dashboard
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

// Serve the existing marketing site (index.html, robots.txt, sitemap.xml) from the repo root
app.use(express.static(path.join(__dirname, '..')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  db.ready.then(() => {
    app.listen(PORT, () => console.log(`Movr backend listening on port ${PORT}`));
  });
}

module.exports = app;
module.exports.ready = db.ready;
