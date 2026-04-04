import type Database from 'better-sqlite3';

export interface ExpertiseRow {
  agent_id: string;
  category: string;
  memory_count: number;
  last_stored_at: string;
  avg_importance: number;
}

/**
 * Upsert expertise for an agent in a category.
 * If the row exists, increments memory_count and recalculates running average importance.
 * If new, inserts with count=1.
 */
export function updateExpertise(
  db: Database.Database,
  agentId: string,
  category: string,
  importance: number,
): void {
  const now = new Date().toISOString();

  const existing = db
    .prepare<[string, string], ExpertiseRow>(
      'SELECT * FROM hive_expertise WHERE agent_id = ? AND category = ?',
    )
    .get(agentId, category);

  if (existing) {
    const newCount = existing.memory_count + 1;
    const newAvg =
      (existing.avg_importance * existing.memory_count + importance) / newCount;

    db.prepare(
      `UPDATE hive_expertise
       SET memory_count = ?, avg_importance = ?, last_stored_at = ?
       WHERE agent_id = ? AND category = ?`,
    ).run(newCount, newAvg, now, agentId, category);
  } else {
    db.prepare(
      `INSERT INTO hive_expertise (agent_id, category, memory_count, last_stored_at, avg_importance)
       VALUES (?, ?, 1, ?, ?)`,
    ).run(agentId, category, now, importance);
  }
}

/**
 * Returns all expertise rows for an agent, sorted by memory_count DESC.
 */
export function getExpertise(
  db: Database.Database,
  agentId: string,
): ExpertiseRow[] {
  return db
    .prepare<[string], ExpertiseRow>(
      `SELECT * FROM hive_expertise WHERE agent_id = ? ORDER BY memory_count DESC`,
    )
    .all(agentId);
}

/**
 * Alias for getExpertise — returns the full expertise profile for an agent.
 */
export function getAgentProfile(
  db: Database.Database,
  agentId: string,
): ExpertiseRow[] {
  return getExpertise(db, agentId);
}

/**
 * Find agents expert in a topic using LIKE matching on category.
 * Sorted by (memory_count * avg_importance) DESC, limited to `limit` results.
 */
export function getTopExperts(
  db: Database.Database,
  topic: string,
  limit = 5,
): ExpertiseRow[] {
  return db
    .prepare<[string, number], ExpertiseRow>(
      `SELECT * FROM hive_expertise
       WHERE category LIKE ?
       ORDER BY (memory_count * avg_importance) DESC
       LIMIT ?`,
    )
    .all(`%${topic}%`, limit);
}

/**
 * Returns all expertise rows across all agents,
 * sorted by (memory_count * avg_importance) DESC.
 */
export function getAllExpertise(db: Database.Database): ExpertiseRow[] {
  return db
    .prepare<[], ExpertiseRow>(
      `SELECT * FROM hive_expertise
       ORDER BY (memory_count * avg_importance) DESC`,
    )
    .all();
}
