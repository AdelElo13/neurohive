import { describe, it, expect, beforeEach } from 'vitest';
import DatabaseConstructor from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { runHiveMigrations } from '../src/schema.js';
import { recordConflict, getConflicts, resolveConflict } from '../src/conflicts.js';

function createDb(): Database.Database {
  const db = new DatabaseConstructor(':memory:');
  runHiveMigrations(db);
  return db;
}

describe('conflicts', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDb();
  });

  it('records a conflict and retrieves it', () => {
    const id = recordConflict(db, {
      memoryAId: 'mem-1',
      memoryBId: 'mem-2',
      agentA: 'agent-alpha',
      agentB: 'agent-beta',
      topic: 'climate',
      similarity: 0.87,
    });

    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');

    const conflicts = getConflicts(db);
    expect(conflicts).toHaveLength(1);

    const conflict = conflicts[0];
    expect(conflict.id).toBe(id);
    expect(conflict.memory_a_id).toBe('mem-1');
    expect(conflict.memory_b_id).toBe('mem-2');
    expect(conflict.agent_a).toBe('agent-alpha');
    expect(conflict.agent_b).toBe('agent-beta');
    expect(conflict.topic).toBe('climate');
    expect(conflict.similarity).toBeCloseTo(0.87);
    expect(conflict.resolved).toBe(0);
    expect(typeof conflict.detected_at).toBe('string');
  });

  it('resolves a conflict and excludes it from default query', () => {
    const id = recordConflict(db, {
      memoryAId: 'mem-3',
      memoryBId: 'mem-4',
      agentA: 'agent-gamma',
      agentB: 'agent-delta',
      topic: 'history',
      similarity: 0.72,
    });

    resolveConflict(db, id);

    const unresolved = getConflicts(db);
    expect(unresolved).toHaveLength(0);
  });

  it('getConflicts with includeResolved=true returns all conflicts', () => {
    const idA = recordConflict(db, {
      memoryAId: 'mem-5',
      memoryBId: 'mem-6',
      agentA: 'agent-one',
      agentB: 'agent-two',
      topic: 'science',
      similarity: 0.91,
    });

    const idB = recordConflict(db, {
      memoryAId: 'mem-7',
      memoryBId: 'mem-8',
      agentA: 'agent-three',
      agentB: 'agent-four',
      topic: 'math',
      similarity: 0.65,
    });

    resolveConflict(db, idA);

    const unresolved = getConflicts(db);
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].id).toBe(idB);

    const all = getConflicts(db, { includeResolved: true });
    expect(all).toHaveLength(2);
    const ids = all.map((c) => c.id);
    expect(ids).toContain(idA);
    expect(ids).toContain(idB);
  });
});
