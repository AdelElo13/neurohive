import { describe, it, expect, beforeEach } from 'vitest';
import DatabaseConstructor from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { runHiveMigrations } from '../src/schema.js';
import { getDashboardData, formatDashboard } from '../src/dashboard.js';

function createDb(): Database.Database {
  const db = new DatabaseConstructor(':memory:');
  runHiveMigrations(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      namespace TEXT NOT NULL DEFAULT 'default',
      category TEXT DEFAULT '',
      agent_id TEXT,
      importance REAL DEFAULT 0.5,
      created_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0
    );
  `);
  return db;
}

describe('dashboard', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb();
  });

  it('aggregates dashboard data correctly', () => {
    const insert = db.prepare(`INSERT INTO memories
      (id, content, namespace, category, agent_id, importance, created_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    insert.run('m1', 'Rust is fast', 'acme', 'engineering', 'agent-alpha', 0.9, '2024-01-01T00:00:00Z', 0);
    insert.run('m2', 'TypeScript is typed', 'acme', 'engineering', 'agent-alpha', 0.8, '2024-01-02T00:00:00Z', 0);
    insert.run('m3', 'Python is readable', 'acme', 'scripting', 'agent-beta', 0.7, '2024-01-03T00:00:00Z', 0);
    // deleted memory — should be excluded
    insert.run('m4', 'deleted memory', 'acme', 'engineering', 'agent-alpha', 0.5, '2024-01-04T00:00:00Z', 1);
    // different namespace — should be excluded
    insert.run('m5', 'other namespace', 'other', 'misc', 'agent-gamma', 0.5, '2024-01-05T00:00:00Z', 0);

    const data = getDashboardData(db, 'acme');

    expect(data.namespace).toBe('acme');
    expect(data.totalMemories).toBe(3);

    const agentIds = data.agents.map((a) => a.agent_id);
    expect(agentIds).toContain('agent-alpha');
    expect(agentIds).toContain('agent-beta');
    expect(agentIds).not.toContain('agent-gamma');

    const alpha = data.agents.find((a) => a.agent_id === 'agent-alpha');
    expect(alpha?.memory_count).toBe(2);

    const beta = data.agents.find((a) => a.agent_id === 'agent-beta');
    expect(beta?.memory_count).toBe(1);

    const categoryNames = data.categories.map((c) => c.category);
    expect(categoryNames).toContain('engineering');
    expect(categoryNames).toContain('scripting');

    const engineering = data.categories.find((c) => c.category === 'engineering');
    expect(engineering?.count).toBe(2);

    expect(data.recentActivity.length).toBeLessThanOrEqual(10);
    expect(data.recentActivity.length).toBe(3);

    expect(data.conflicts).toBe(0);
  });

  it('counts unresolved conflicts correctly', () => {
    const insertMemory = db.prepare(`INSERT INTO memories
      (id, content, namespace, category, agent_id, importance, created_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insertMemory.run('m1', 'fact A', 'corp', 'science', 'agent-1', 0.8, '2024-01-01T00:00:00Z', 0);

    const insertConflict = db.prepare(`INSERT INTO hive_conflicts
      (id, memory_a_id, memory_b_id, agent_a, agent_b, topic, similarity, detected_at, resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    insertConflict.run('c1', 'm1', 'm2', 'agent-1', 'agent-2', 'science', 0.9, '2024-01-01T00:00:00Z', 0);
    insertConflict.run('c2', 'm3', 'm4', 'agent-3', 'agent-4', 'history', 0.7, '2024-01-02T00:00:00Z', 1); // resolved

    const data = getDashboardData(db, 'corp');
    expect(data.conflicts).toBe(1);
  });

  it('formatDashboard produces readable output with all sections', () => {
    const insert = db.prepare(`INSERT INTO memories
      (id, content, namespace, category, agent_id, importance, created_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

    insert.run('m1', 'Distributed systems require careful design', 'team', 'architecture', 'agent-alpha', 0.9, '2024-01-01T00:00:00Z', 0);
    insert.run('m2', 'TypeScript improves developer experience', 'team', 'engineering', 'agent-alpha', 0.8, '2024-01-02T00:00:00Z', 0);
    insert.run('m3', 'Code review is essential for quality', 'team', 'engineering', 'agent-beta', 0.7, '2024-01-03T00:00:00Z', 0);

    const data = getDashboardData(db, 'team');
    const output = formatDashboard(data);

    // has company/namespace name and total
    expect(output).toContain('team');
    expect(output).toContain('3');

    // has agents section
    expect(output).toContain('agent-alpha');
    expect(output).toContain('agent-beta');

    // has knowledge map / categories section
    expect(output).toContain('engineering');
    expect(output).toContain('architecture');

    // bar chart characters
    expect(output).toContain('█');
    expect(output).toContain('░');

    // recent activity section (content truncated to 60 chars)
    expect(output).toContain('Distributed systems');

    // no conflicts warning
    expect(output.toLowerCase()).not.toContain('conflict');
  });

  it('formatDashboard shows conflict warning when conflicts exist', () => {
    const insert = db.prepare(`INSERT INTO memories
      (id, content, namespace, category, agent_id, importance, created_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    insert.run('m1', 'some memory', 'corp', 'misc', 'agent-1', 0.5, '2024-01-01T00:00:00Z', 0);

    db.prepare(`INSERT INTO hive_conflicts
      (id, memory_a_id, memory_b_id, agent_a, agent_b, topic, similarity, detected_at, resolved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('c1', 'm1', 'm2', 'agent-1', 'agent-2', 'misc', 0.9, '2024-01-01T00:00:00Z', 0);

    const data = getDashboardData(db, 'corp');
    const output = formatDashboard(data);

    expect(output.toLowerCase()).toContain('conflict');
  });
});
