import type Database from 'better-sqlite3';
import { getExpertise } from './tracker.js';

export interface PrimingQueryInput {
  readonly agentRole: string;
  readonly primingCategories: readonly string[];
  readonly db: Database.Database;
  readonly agentId: string;
}

export interface PrimingMemory {
  readonly content: string;
  readonly category: string;
  readonly agent_id: string | null;
  readonly importance: number;
  readonly created_at: string;
}

/**
 * Builds a priming search query string for an agent session startup.
 * Priority:
 *   1. Explicit primingCategories joined with spaces
 *   2. Agent's top 5 expertise categories from hive_expertise
 *   3. Fallback: "most important recent knowledge"
 */
export function buildPrimingQuery(input: PrimingQueryInput): string {
  const { primingCategories, db, agentId } = input;

  if (primingCategories.length > 0) {
    return primingCategories.join(' ');
  }

  const expertise = getExpertise(db, agentId);
  const top5 = expertise.slice(0, 5);

  if (top5.length > 0) {
    return top5.map((row) => row.category).join(' ');
  }

  return 'most important recent knowledge';
}

/**
 * Formats a list of priming memories into a human-readable context block.
 * Format:
 *   Here is what the team knows so far:
 *   - {content} (from {agent_id})
 *   ...
 */
export function formatPrimingContext(memories: PrimingMemory[]): string {
  const header = 'Here is what the team knows so far:\n';
  const lines = memories.map((m) => `- ${m.content} (from ${m.agent_id})`);
  return header + lines.join('\n');
}
