import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runHiveMigrations } from '../src/schema.js';
import {
  updateExpertise,
  getExpertise,
  getAgentProfile,
  getTopExperts,
  getAllExpertise,
} from '../src/tracker.js';

let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:');
  runHiveMigrations(db);
});

describe('updateExpertise', () => {
  it('records expertise on first store', () => {
    updateExpertise(db, 'agent-1', 'typescript', 0.8);
    const rows = getExpertise(db, 'agent-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].agent_id).toBe('agent-1');
    expect(rows[0].category).toBe('typescript');
    expect(rows[0].memory_count).toBe(1);
    expect(rows[0].avg_importance).toBeCloseTo(0.8);
  });

  it('increments count on subsequent stores with correct running average', () => {
    updateExpertise(db, 'agent-1', 'typescript', 0.8);
    updateExpertise(db, 'agent-1', 'typescript', 0.4);
    const rows = getExpertise(db, 'agent-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].memory_count).toBe(2);
    // Running average: (0.8 + 0.4) / 2 = 0.6
    expect(rows[0].avg_importance).toBeCloseTo(0.6);
  });

  it('tracks multiple categories per agent', () => {
    updateExpertise(db, 'agent-1', 'typescript', 0.9);
    updateExpertise(db, 'agent-1', 'typescript', 0.7);
    updateExpertise(db, 'agent-1', 'python', 0.5);
    const rows = getExpertise(db, 'agent-1');
    expect(rows).toHaveLength(2);
    // Sorted by memory_count DESC — typescript has 2, python has 1
    expect(rows[0].category).toBe('typescript');
    expect(rows[0].memory_count).toBe(2);
    expect(rows[1].category).toBe('python');
    expect(rows[1].memory_count).toBe(1);
  });
});

describe('getAgentProfile', () => {
  it('returns sorted by memory_count DESC', () => {
    updateExpertise(db, 'agent-2', 'golang', 0.6);
    updateExpertise(db, 'agent-2', 'rust', 0.9);
    updateExpertise(db, 'agent-2', 'rust', 0.7);
    updateExpertise(db, 'agent-2', 'rust', 0.8);
    const profile = getAgentProfile(db, 'agent-2');
    expect(profile[0].category).toBe('rust');
    expect(profile[0].memory_count).toBe(3);
    expect(profile[1].category).toBe('golang');
    expect(profile[1].memory_count).toBe(1);
  });
});

describe('getTopExperts', () => {
  it('finds correct expert by topic', () => {
    // agent-1 has a lot of typescript expertise
    updateExpertise(db, 'agent-1', 'typescript', 0.9);
    updateExpertise(db, 'agent-1', 'typescript', 0.8);
    updateExpertise(db, 'agent-1', 'typescript', 0.7);
    // agent-2 has a little typescript
    updateExpertise(db, 'agent-2', 'typescript', 0.5);
    // agent-3 is about python
    updateExpertise(db, 'agent-3', 'python', 0.9);

    const experts = getTopExperts(db, 'typescript');
    expect(experts.length).toBeGreaterThanOrEqual(2);
    expect(experts[0].agent_id).toBe('agent-1');
    // agent-3 should not appear
    const agentIds = experts.map((e) => e.agent_id);
    expect(agentIds).not.toContain('agent-3');
  });

  it('uses LIKE matching so partial topic names work', () => {
    updateExpertise(db, 'agent-1', 'typescript-advanced', 0.8);
    updateExpertise(db, 'agent-2', 'python', 0.8);
    const experts = getTopExperts(db, 'typescript');
    expect(experts.map((e) => e.agent_id)).toContain('agent-1');
    expect(experts.map((e) => e.agent_id)).not.toContain('agent-2');
  });

  it('respects the limit parameter', () => {
    for (let i = 1; i <= 10; i++) {
      updateExpertise(db, `agent-${i}`, 'typescript', 0.5);
    }
    const experts = getTopExperts(db, 'typescript', 3);
    expect(experts).toHaveLength(3);
  });
});

describe('getAllExpertise', () => {
  it('returns all rows across agents sorted by score DESC', () => {
    updateExpertise(db, 'agent-1', 'typescript', 0.9);
    updateExpertise(db, 'agent-1', 'typescript', 0.9);
    updateExpertise(db, 'agent-2', 'python', 0.3);
    const all = getAllExpertise(db);
    expect(all).toHaveLength(2);
    // typescript: count=2, avg=0.9, score=1.8 > python: count=1, avg=0.3, score=0.3
    expect(all[0].category).toBe('typescript');
    expect(all[1].category).toBe('python');
  });
});
