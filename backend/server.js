const path = require('path');
const express = require('express');
const db = require('./src/db');
const quotesRouter = require('./src/routes/quotes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

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
