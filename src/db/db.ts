import { mkdirSync } from "node:fs";
import { Database } from "bun:sqlite";

mkdirSync("./data", { recursive: true });
const db = new Database("./data/mydb.sqlite", { create: true });

if (!db.query("SELECT * FROM sqlite_master WHERE type='table'").get()) {
  db.exec(`
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS file_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  output_file_name TEXT NOT NULL,
  status TEXT DEFAULT 'not started',
  error_message TEXT,
  FOREIGN KEY (job_id) REFERENCES jobs(id)
);
CREATE TABLE IF NOT EXISTS jobs (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	user_id INTEGER NOT NULL,
	date_created TEXT NOT NULL,
  status TEXT DEFAULT 'not started',
  num_files INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
PRAGMA user_version = 4;`);
}

let dbVersion = (db.query("PRAGMA user_version").get() as { user_version?: number }).user_version;

function hasColumn(table: string, column: string) {
  return db
    .query(`PRAGMA table_info(${table})`)
    .all()
    .some((row) => (row as { name?: string }).name === column);
}

function nextUsername(value: string, taken: Set<string>) {
  const trimmed = value.trim();
  const base = (trimmed.includes("@") ? (trimmed.split("@")[0] ?? "") : trimmed)
    .trim()
    .replace(/\s+/g, "_");
  const fallback = base || "user";
  let username = fallback;
  let index = 2;

  while (taken.has(username)) {
    username = `${fallback}-${index}`;
    index++;
  }

  taken.add(username);
  return username;
}

function migrateUsersToUsername() {
  const hasUsername = hasColumn("users", "username");
  const hasEmail = hasColumn("users", "email");
  const hasIsAdmin = hasColumn("users", "is_admin");
  if (hasUsername && !hasEmail) {
    return;
  }

  const usernameSelect = hasUsername ? "username" : "NULL AS username";
  const emailSelect = hasEmail ? "email" : "NULL AS email";
  const isAdminSelect = hasIsAdmin ? "is_admin" : "0 AS is_admin";
  const users = db
    .query(
      `SELECT id, ${usernameSelect}, ${emailSelect}, password, ${isAdminSelect} FROM users ORDER BY id`,
    )
    .all() as {
    id: number;
    username?: string | null;
    email?: string | null;
    password: string;
    is_admin?: number | null;
  }[];

  db.exec(`
CREATE TABLE users_migrated (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);`);

  const taken = new Set<string>();
  const insert = db.query(
    "INSERT INTO users_migrated (id, username, password, is_admin) VALUES (?1, ?2, ?3, ?4)",
  );

  for (const user of users) {
    const username = nextUsername(user.username || user.email || `user${user.id}`, taken);
    insert.run(user.id, username, user.password, user.is_admin ? 1 : 0);
  }

  db.exec(`
DROP TABLE users;
ALTER TABLE users_migrated RENAME TO users;`);
}

if (dbVersion === 0) {
  if (!hasColumn("file_names", "status")) {
    db.exec("ALTER TABLE file_names ADD COLUMN status TEXT DEFAULT 'not started';");
  }
  db.exec("PRAGMA user_version = 1;");
  console.log("Updated database to version 1.");
  dbVersion = 1;
}

if (dbVersion === 1) {
  migrateUsersToUsername();
  db.exec("PRAGMA user_version = 2;");
  console.log("Updated database to version 2.");
  dbVersion = 2;
}

if (dbVersion === 2) {
  if (!hasColumn("file_names", "error_message")) {
    db.exec("ALTER TABLE file_names ADD COLUMN error_message TEXT;");
  }
  db.exec("PRAGMA user_version = 3;");
  console.log("Updated database to version 3.");
  dbVersion = 3;
}

if (dbVersion === 3) {
  if (!hasColumn("users", "is_admin")) {
    db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;");
  }
  db.exec(`
UPDATE users
SET is_admin = 1
WHERE id = (SELECT MIN(id) FROM users)
  AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = 1);
PRAGMA user_version = 4;`);
  console.log("Updated database to version 4.");
}

// enable WAL mode
db.exec("PRAGMA journal_mode = WAL;");

export default db;
