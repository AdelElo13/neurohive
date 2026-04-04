import { createHash } from 'crypto';
import type Database from 'better-sqlite3';

export interface ConflictInput {
  readonly memoryAId: string;
  readonly memoryBId: string;
  readonly agentA: string;
  readonly agentB: string;
  readonly topic: string;
  readonly similarity: number;
}

export interface ConflictRow {
  readonly id: string;
  readonly memory_a_id: string;
  readonly memory_b_id: string;
  readonly agent_a: string;
  readonly agent_b: string;
  readonly topic: string;
  readonly similarity: number;
  readonly detected_at: string;
  readonly resolved: number;
}

export function recordConflict(db: Database.Database, input: ConflictInput): string {
  const detectedAt = new Date().toISOString();
  const id = createHash('sha256')
    .update(`${input.memoryAId}:${input.memoryBId}:${detectedAt}:${Math.random()}`)
    .digest('hex')
    .slice(0, 16);

  db.prepare(`
    INSERT INTO hive_conflicts
      (id, memory_a_id, memory_b_id, agent_a, agent_b, topic, similarity, detected_at, resolved)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    id,
    input.memoryAId,
    input.memoryBId,
    input.agentA,
    input.agentB,
    input.topic,
    input.similarity,
    detectedAt,
  );

  return id;
}

export function getConflicts(
  db: Database.Database,
  options?: { includeResolved?: boolean },
): ConflictRow[] {
  const includeResolved = options?.includeResolved ?? false;

  if (includeResolved) {
    return db.prepare('SELECT * FROM hive_conflicts ORDER BY detected_at ASC').all() as ConflictRow[];
  }

  return db
    .prepare('SELECT * FROM hive_conflicts WHERE resolved = 0 ORDER BY detected_at ASC')
    .all() as ConflictRow[];
}

export function resolveConflict(db: Database.Database, conflictId: string): void {
  db.prepare('UPDATE hive_conflicts SET resolved = 1 WHERE id = ?').run(conflictId);
}
