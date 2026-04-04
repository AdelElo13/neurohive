import type { StoreInput, StoreDeps } from 'neuromcp/tools/store';
import type { SearchInput, SearchDeps } from 'neuromcp/tools/search';
import type { StoreResultExtended, MemoryWithScore } from 'neuromcp/types';
import { storeMemory } from 'neuromcp/tools/store';
import { searchMemory } from 'neuromcp/tools/search';
import { updateExpertise } from './tracker.js';
import { recordConflict } from './conflicts.js';

const RECENT_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface HiveStoreResult extends StoreResultExtended {
  readonly _hivemind: {
    readonly agent_id: string;
    readonly expertise_updated: boolean;
    readonly conflicts_recorded: number;
  };
}

export interface HiveSearchResult extends MemoryWithScore {
  readonly _hivemind: {
    readonly stored_by: string | null;
    readonly stored_at: string;
    readonly is_recent: boolean;
  };
}

/**
 * Wraps neuromcp's storeMemory with expertise tracking and conflict recording.
 */
export async function hiveStore(
  input: StoreInput,
  deps: StoreDeps,
  agentId: string,
): Promise<HiveStoreResult> {
  const result = await storeMemory(input, deps);

  const category = input.category ?? 'uncategorized';
  const importance = input.importance ?? 0.5;
  updateExpertise(deps.db, agentId, category, importance);

  let conflictsRecorded = 0;

  if (result.contradictions !== undefined && result.contradictions.length > 0) {
    for (const contradiction of result.contradictions) {
      recordConflict(deps.db, {
        memoryAId: result.id,
        memoryBId: contradiction.existing_id,
        agentA: agentId,
        agentB: '', // existing memory's agent is unknown at this level
        topic: category,
        similarity: contradiction.similarity,
      });
      conflictsRecorded += 1;
    }
  }

  return {
    ...result,
    _hivemind: {
      agent_id: agentId,
      expertise_updated: true,
      conflicts_recorded: conflictsRecorded,
    },
  };
}

/**
 * Wraps neuromcp's searchMemory with hive-mind annotations.
 */
export async function hiveSearch(
  input: SearchInput,
  deps: SearchDeps,
): Promise<readonly HiveSearchResult[]> {
  const results = await searchMemory(input, deps);
  const now = Date.now();

  return results.map((mem) => ({
    ...mem,
    _hivemind: {
      stored_by: mem.agent_id,
      stored_at: mem.created_at,
      is_recent: now - new Date(mem.created_at).getTime() < RECENT_THRESHOLD_MS,
    },
  }));
}
