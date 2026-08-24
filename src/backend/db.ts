import Database from 'better-sqlite3';

// Path to the SQLite file (placed in the project root for simplicity)
const DB_PATH = `${process.cwd()}/data/app.db`;

// Initialize the database connection (synchronous)
const db = new Database(DB_PATH);

// Ensure the settings table exists
const init = db.prepare(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
  );
`);
init.run();

/** Get a setting by key */
export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

/** Set or update a setting */
export function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

/** Get all settings as an object */
export function getAllSettings(): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result: Record<string, string> = {};
  for (const { key, value } of rows) {
    result[key] = value;
  }
  return result;
}

/** Delete a setting */
export function deleteSetting(key: string): void {
  db.prepare('DELETE FROM settings WHERE key = ?').run(key);
}

/** Create an employee */
export function createEmployee(name: string, email: string): number | bigint {
  const info = db.prepare('INSERT INTO employees (name, email) VALUES (?, ?)').run(name, email);
  return info.lastInsertRowid;
}

/** Get all employees */
export function getAllEmployees(): any[] {
  return db.prepare('SELECT * FROM employees').all();
}

/** Update an employee */
export function updateEmployee(id: number, name: string, email: string): void {
  db.prepare('UPDATE employees SET name = ?, email = ? WHERE id = ?').run(name, email, id);
}

/** Delete an employee */
export function deleteEmployee(id: number): void {
  db.prepare('DELETE FROM employees WHERE id = ?').run(id);
}

export default db;
