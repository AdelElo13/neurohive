import type Database from 'better-sqlite3';

export function runHiveMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hive_expertise (
      agent_id TEXT NOT NULL,
      category TEXT NOT NULL,
      memory_count INTEGER DEFAULT 0,
      last_stored_at TEXT,
      avg_importance REAL DEFAULT 0.5,
      PRIMARY KEY (agent_id, category)
    );

    CREATE TABLE IF NOT EXISTS hive_conflicts (
      id TEXT PRIMARY KEY,
      memory_a_id TEXT NOT NULL,
      memory_b_id TEXT NOT NULL,
      agent_a TEXT,
      agent_b TEXT,
      topic TEXT,
      similarity REAL,
      detected_at TEXT NOT NULL,
      resolved INTEGER DEFAULT 0
    );
  `);
}
