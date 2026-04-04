import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import DatabaseConstructor from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { runHiveMigrations } from '../src/schema.js';
import { buildPrimingQuery, formatPrimingContext, type PrimingMemory } from '../src/primer.js';

function createInMemoryDb(): Database.Database {
  const db = new DatabaseConstructor(':memory:');
  runHiveMigrations(db);
  return db;
}

describe('buildPrimingQuery', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createInMemoryDb();
  });

  afterEach(() => {
    db.close();
  });

  it('builds query from explicit categories when provided', () => {
    const result = buildPrimingQuery({
      agentRole: 'backend-engineer',
      primingCategories: ['typescript', 'databases', 'testing'],
      db,
      agentId: 'agent-1',
    });

    expect(result).toBe('typescript databases testing');
  });

  it('builds query from expertise when no explicit categories set', () => {
    db.prepare(
      'INSERT INTO hive_expertise (agent_id, category, memory_count, avg_importance) VALUES (?, ?, ?, ?)',
    ).run('agent-2', 'rust', 10, 0.9);
    db.prepare(
      'INSERT INTO hive_expertise (agent_id, category, memory_count, avg_importance) VALUES (?, ?, ?, ?)',
    ).run('agent-2', 'performance', 8, 0.8);
    db.prepare(
      'INSERT INTO hive_expertise (agent_id, category, memory_count, avg_importance) VALUES (?, ?, ?, ?)',
    ).run('agent-2', 'concurrency', 5, 0.7);

    const result = buildPrimingQuery({
      agentRole: 'systems-engineer',
      primingCategories: [],
      db,
      agentId: 'agent-2',
    });

    expect(result).toBe('rust performance concurrency');
  });

  it('only uses top 5 expertise categories', () => {
    for (let i = 1; i <= 7; i++) {
      db.prepare(
        'INSERT INTO hive_expertise (agent_id, category, memory_count, avg_importance) VALUES (?, ?, ?, ?)',
      ).run('agent-3', `category-${i}`, 10 - i, 0.9 - i * 0.1);
    }

    const result = buildPrimingQuery({
      agentRole: 'generalist',
      primingCategories: [],
      db,
      agentId: 'agent-3',
    });

    const categories = result.split(' ');
    expect(categories).toHaveLength(5);
    expect(categories[0]).toBe('category-1');
  });

  it('falls back to generic query when no expertise and no categories', () => {
    const result = buildPrimingQuery({
      agentRole: 'new-agent',
      primingCategories: [],
      db,
      agentId: 'agent-unknown',
    });

    expect(result).toBe('most important recent knowledge');
  });
});

describe('formatPrimingContext', () => {
  it('formats priming context as readable text with agent attribution', () => {
    const memories: PrimingMemory[] = [
      {
        content: 'Always use parameterized queries to prevent SQL injection',
        category: 'security',
        agent_id: 'security-bot',
        importance: 0.95,
        created_at: '2026-04-01T10:00:00Z',
      },
      {
        content: 'Prefer immutable data structures for concurrent systems',
        category: 'architecture',
        agent_id: 'arch-agent',
        importance: 0.85,
        created_at: '2026-04-02T11:00:00Z',
      },
    ];

    const result = formatPrimingContext(memories);

    expect(result).toBe(
      'Here is what the team knows so far:\n' +
        '- Always use parameterized queries to prevent SQL injection (from security-bot)\n' +
        '- Prefer immutable data structures for concurrent systems (from arch-agent)',
    );
  });

  it('handles memories with null agent_id', () => {
    const memories: PrimingMemory[] = [
      {
        content: 'Use short-lived tokens for API authentication',
        category: 'security',
        agent_id: null,
        importance: 0.8,
        created_at: '2026-04-03T09:00:00Z',
      },
    ];

    const result = formatPrimingContext(memories);

    expect(result).toBe(
      'Here is what the team knows so far:\n' +
        '- Use short-lived tokens for API authentication (from null)',
    );
  });

  it('returns header only when no memories provided', () => {
    const result = formatPrimingContext([]);

    expect(result).toBe('Here is what the team knows so far:\n');
  });
});
