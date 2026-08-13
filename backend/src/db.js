const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');

let db;

const ready = initSqlJs().then((SQL) => {
  const existing = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : undefined;
  db = new SQL.Database(existing);

  db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      phone         TEXT NOT NULL,
      email         TEXT NOT NULL,
      service       TEXT NOT NULL CHECK (service IN ('moving', 'junk', 'equipment', 'not-sure')),
      from_address  TEXT,
      to_address    TEXT,
      preferred_date TEXT,
      details       TEXT,
      source        TEXT,
      status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'quoted', 'booked', 'closed')),
      created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
    CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at);

    CREATE TABLE IF NOT EXISTS quote_notes (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id   INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      note       TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE INDEX IF NOT EXISTS idx_quote_notes_quote_id ON quote_notes(quote_id);
  `);

  // Databases created before addresses existed won't pick up the new columns from
  // CREATE TABLE IF NOT EXISTS, so add them in place. Both stay nullable: rows
  // predating this change have no address, and junk removal never has a
  // destination. Required-ness is enforced per-service in the API layer instead.
  addColumnIfMissing('quotes', 'from_address', 'TEXT');
  addColumnIfMissing('quotes', 'to_address', 'TEXT');

  persist();
});

function addColumnIfMissing(table, column, definition) {
  const existing = all(`PRAGMA table_info(${table})`);
  if (!existing.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function persist() {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  const changes = db.getRowsModified();
  const idResult = db.exec('SELECT last_insert_rowid() AS id');
  const lastInsertRowid = idResult.length ? idResult[0].values[0][0] : undefined;
  persist();
  return { changes, lastInsertRowid };
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row;
  if (stmt.step()) row = stmt.getAsObject();
  stmt.free();
  return row && Object.keys(row).length ? row : undefined;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

module.exports = { ready, run, get, all };
