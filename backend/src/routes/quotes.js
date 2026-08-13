const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const VALID_SERVICES = ['moving', 'junk', 'equipment', 'not-sure'];
const VALID_STATUSES = ['new', 'contacted', 'quoted', 'booked', 'closed'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateQuoteInput(body) {
  const errors = [];
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const service = String(body.service || '').trim();
  const preferredDate = body.date ? String(body.date).trim() : null;
  const details = body.details ? String(body.details).trim() : null;

  if (!name) errors.push('name is required');
  if (!phone) errors.push('phone is required');
  if (!email || !EMAIL_RE.test(email)) errors.push('a valid email is required');
  if (!VALID_SERVICES.includes(service)) {
    errors.push(`service must be one of: ${VALID_SERVICES.join(', ')}`);
  }

  return { errors, value: { name, phone, email, service, preferredDate, details } };
}

// POST /api/quotes — public endpoint used by the site's quote form
router.post('/', (req, res) => {
  const { errors, value } = validateQuoteInput(req.body || {});
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid input', details: errors });
  }

  const source = req.body.source ? String(req.body.source).trim() : 'getmovr.ca quote form';

  const info = db.run(
    `INSERT INTO quotes (name, phone, email, service, preferred_date, details, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [value.name, value.phone, value.email, value.service, value.preferredDate, value.details, source]
  );

  const created = db.get('SELECT * FROM quotes WHERE id = ?', [info.lastInsertRowid]);
  res.status(201).json(created);
});

// GET /api/quotes — admin: list, filter by status, paginate
router.get('/', requireAdmin, (req, res) => {
  const { status, limit = '50', offset = '0' } = req.query;

  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  const lim = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);

  let rows;
  let total;
  if (status) {
    rows = db.all(
      'SELECT * FROM quotes WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [status, lim, off]
    );
    total = db.get('SELECT COUNT(*) AS n FROM quotes WHERE status = ?', [status]).n;
  } else {
    rows = db.all('SELECT * FROM quotes ORDER BY created_at DESC LIMIT ? OFFSET ?', [lim, off]);
    total = db.get('SELECT COUNT(*) AS n FROM quotes', []).n;
  }

  res.json({ total, limit: lim, offset: off, results: rows });
});

// GET /api/quotes/:id — admin: single quote + its notes
router.get('/:id', requireAdmin, (req, res) => {
  const quote = db.get('SELECT * FROM quotes WHERE id = ?', [req.params.id]);
  if (!quote) return res.status(404).json({ error: 'Not found' });

  const notes = db.all('SELECT * FROM quote_notes WHERE quote_id = ? ORDER BY created_at ASC', [req.params.id]);

  res.json({ ...quote, notes });
});

// PATCH /api/quotes/:id — admin: update status
router.patch('/:id', requireAdmin, (req, res) => {
  const quote = db.get('SELECT * FROM quotes WHERE id = ?', [req.params.id]);
  if (!quote) return res.status(404).json({ error: 'Not found' });

  const { status } = req.body || {};
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  db.run(
    `UPDATE quotes SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`,
    [status, req.params.id]
  );

  res.json(db.get('SELECT * FROM quotes WHERE id = ?', [req.params.id]));
});

// POST /api/quotes/:id/notes — admin: append a note
router.post('/:id/notes', requireAdmin, (req, res) => {
  const quote = db.get('SELECT * FROM quotes WHERE id = ?', [req.params.id]);
  if (!quote) return res.status(404).json({ error: 'Not found' });

  const note = String((req.body || {}).note || '').trim();
  if (!note) return res.status(400).json({ error: 'note is required' });

  const info = db.run('INSERT INTO quote_notes (quote_id, note) VALUES (?, ?)', [req.params.id, note]);

  res.status(201).json(db.get('SELECT * FROM quote_notes WHERE id = ?', [info.lastInsertRowid]));
});

module.exports = router;
