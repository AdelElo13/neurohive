import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerDeps } from 'neuromcp/server';
import type { HiveConfig } from './config.js';
import { hiveStore, hiveSearch } from './wrappers.js';
import { recallMemory } from 'neuromcp/tools/recall';
import { forgetMemory } from 'neuromcp/tools/forget';
import { consolidate } from 'neuromcp/tools/consolidate';
import { memoryStats } from 'neuromcp/tools/stats';
import { exportMemories, importMemories } from 'neuromcp/tools/admin';
import { backfillEmbeddings } from 'neuromcp/tools/backfill';
import { createEntity, createRelation, queryGraph } from 'neuromcp/tools/graph';
import { searchClaims, getClaimsForMemory } from 'neuromcp/cognitive/claims';
import { registerResources } from 'neuromcp/resources';
import { registerPrompts } from 'neuromcp/prompts';
import { registerHiveTools } from './tools.js';
import { registerHiveResources } from './resources.js';

function textResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

export function createHiveServer(deps: ServerDeps, hiveConfig: HiveConfig): McpServer {
  const { db, vecStore, embedder, config, logger, metrics } = deps;

  const server = new McpServer(
    { name: 'hive-mind', version: '1.0.0' },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    },
  );

  const agentId = hiveConfig.hiveAgent || 'unknown';

  // ─── Tool 1: store_memory (wrapped with hive intelligence) ───────
  server.registerTool('store_memory', {
    description: 'Store a new memory with semantic deduplication, contradiction detection, surprise scoring, entity extraction, and hive-mind expertise tracking.',
    inputSchema: {
      content: z.string().describe('The memory content to store'),
      namespace: z.string().optional().describe('Namespace to store in (default: config default)'),
      category: z.string().optional().describe('Category label (e.g. "code", "conversation", "fact")'),
      tags: z.array(z.string()).optional().describe('Tags for filtering'),
      importance: z.number().min(0).max(1).optional().describe('Importance score 0-1 (default: 0.5)'),
      source: z.enum(['user', 'auto', 'consolidation', 'claude-code', 'error']).optional().describe('Source of the memory'),
      source_trust: z.enum(['high', 'medium', 'low', 'unverified']).optional().describe('Trust level'),
      project_id: z.string().optional().describe('Project identifier'),
      agent_id: z.string().optional().describe('Agent identifier'),
      metadata: z.record(z.unknown()).optional().describe('Arbitrary metadata'),
      expires_at: z.string().optional().describe('ISO 8601 expiration timestamp'),
      valid_from: z.string().optional().describe('ISO 8601 timestamp when this fact becomes valid (default: now)'),
      valid_to: z.string().optional().describe('ISO 8601 timestamp when this fact stops being valid'),
    },
  }, async (args) => {
    const storeAgentId = args.agent_id ?? agentId;
    const result = await hiveStore(args, { db, vecStore, embedder, logger, metrics, config }, storeAgentId);
    return textResult(result);
  });

  // ─── Tool 2: search_memory (wrapped with hive annotations) ──────
  server.registerTool('search_memory', {
    description: 'Search memories using hybrid vector + full-text search with RRF ranking, graph boost, cognitive priming, and hive-mind annotations.',
    inputSchema: {
      query: z.string().describe('Search query text'),
      namespace: z.string().optional().describe('Namespace to search (default: config default)'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 10)'),
      category: z.string().optional().describe('Filter by category'),
      tags: z.array(z.string()).optional().describe('Filter: all tags must be present'),
      min_importance: z.number().min(0).max(1).optional().describe('Minimum importance threshold'),
      min_trust: z.enum(['high', 'medium', 'low', 'unverified']).optional().describe('Minimum trust level'),
      after: z.string().optional().describe('Only memories created after this ISO timestamp'),
      before: z.string().optional().describe('Only memories created before this ISO timestamp'),
      hybrid: z.boolean().optional().describe('Use hybrid search (default: true)'),
      valid_at: z.string().optional().describe('ISO 8601 timestamp — only return memories valid at this time (temporal query)'),
      graph_boost: z.boolean().optional().describe('Boost results connected via knowledge graph (default: true)'),
    },
  }, async (args) => {
    const results = await hiveSearch(args, { db, vecStore, embedder, logger, metrics, config });
    return textResult(results);
  });

  // ─── Tool 3: recall_memory (pass-through) ────────────────────────
  server.registerTool('recall_memory', {
    description: 'Recall memories by ID, namespace, category, or tags without semantic search.',
    inputSchema: {
      id: z.string().optional().describe('Specific memory ID to recall'),
      namespace: z.string().optional().describe('Namespace filter'),
      category: z.string().optional().describe('Category filter'),
      tags: z.array(z.string()).optional().describe('Tags filter: all must match'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 20)'),
    },
  }, (args) => {
    const results = recallMemory(args, db, config, logger, metrics);
    return textResult(results);
  });

  // ─── Tool 4: forget_memory (pass-through) ────────────────────────
  server.registerTool('forget_memory', {
    description: 'Tombstone (soft-delete) memories matching the given filters. At least one filter is required.',
    inputSchema: {
      id: z.string().optional().describe('Specific memory ID to forget'),
      namespace: z.string().optional().describe('Namespace filter'),
      tags: z.array(z.string()).optional().describe('Tags filter'),
      older_than_days: z.number().int().min(1).optional().describe('Delete memories older than N days'),
      below_importance: z.number().min(0).max(1).optional().describe('Delete memories below this importance'),
      dry_run: z.boolean().optional().describe('Preview what would be deleted without actually deleting'),
    },
  }, (args) => {
    const result = forgetMemory(args, db, vecStore, config, logger, metrics);
    return textResult(result);
  });

  // ─── Tool 5: consolidate (pass-through) ──────────────────────────
  server.registerTool('consolidate', {
    description: 'Run consolidation: merge near-duplicates, decay stale memories, prune low-value, sweep expired, purge old tombstones. Set commit=true to apply.',
    inputSchema: {
      namespace: z.string().optional().describe('Namespace to consolidate (default: config default)'),
      similarity_threshold: z.number().min(0).max(1).optional().describe('Similarity threshold for merging'),
      decay_lambda: z.number().optional().describe('Decay rate parameter'),
      min_importance_after_decay: z.number().min(0).max(1).optional().describe('Prune threshold after decay'),
      commit: z.boolean().describe('If false, returns a dry-run plan. If true, executes the plan.'),
    },
  }, (args) => {
    const output = consolidate(args, db, vecStore, embedder, config, logger, metrics);
    return textResult(output);
  });

  // ─── Tool 6: memory_stats (pass-through) ─────────────────────────
  server.registerTool('memory_stats', {
    description: 'Get statistics about stored memories: counts, categories, trust levels, importance, and database size.',
    inputSchema: {
      namespace: z.string().optional().describe('Namespace to get stats for (default: config default, "*" for all)'),
    },
  }, (args) => {
    const stats = memoryStats(args, db, embedder, config);
    return textResult(stats);
  });

  // ─── Tool 7: export_memories (pass-through) ──────────────────────
  server.registerTool('export_memories', {
    description: 'Export memories as JSONL or JSON for backup or migration.',
    inputSchema: {
      namespace: z.string().optional().describe('Namespace to export (default: config default, "*" for all)'),
      format: z.enum(['jsonl', 'json']).optional().describe('Export format (default: jsonl)'),
      include_tombstoned: z.boolean().optional().describe('Include soft-deleted memories'),
    },
  }, (args) => {
    const data = exportMemories(args, db, config);
    return textResult({ data });
  });

  // ─── Tool 8: import_memories (pass-through) ──────────────────────
  server.registerTool('import_memories', {
    description: 'Import memories from JSONL or JSON data. Deduplicates by content hash.',
    inputSchema: {
      data: z.string().describe('JSONL or JSON array string of memory records'),
      namespace: z.string().optional().describe('Override namespace for all imported memories'),
      trust: z.enum(['high', 'medium', 'low', 'unverified']).optional().describe('Trust level for imported memories (default: unverified)'),
    },
  }, async (args) => {
    const result = await importMemories(args, db, vecStore, embedder, config, logger, metrics);
    return textResult(result);
  });

  // ─── Tool 9: backfill_embeddings (pass-through) ──────────────────
  server.registerTool('backfill_embeddings', {
    description: 'Recompute embeddings for all memories missing from the vector store. Also syncs FTS index.',
    inputSchema: {},
  }, async () => {
    const result = await backfillEmbeddings(db, vecStore, embedder, logger, metrics);
    return textResult(result);
  });

  // ─── Tool 10: create_entity (pass-through) ───────────────────────
  server.registerTool('create_entity', {
    description: 'Create or update an entity in the knowledge graph.',
    inputSchema: {
      name: z.string().describe('Entity name'),
      entity_type: z.string().optional().describe('Entity type (default: "concept")'),
      namespace: z.string().optional().describe('Namespace (default: config default)'),
      metadata: z.record(z.unknown()).optional().describe('Arbitrary metadata'),
    },
  }, (args) => {
    const entity = createEntity(args, db, config, logger, metrics);
    return textResult(entity);
  });

  // ─── Tool 11: create_relation (pass-through) ─────────────────────
  server.registerTool('create_relation', {
    description: 'Create a typed relation between two entities in the knowledge graph.',
    inputSchema: {
      source_entity_id: z.string().describe('Source entity ID'),
      target_entity_id: z.string().describe('Target entity ID'),
      relation_type: z.string().describe('Relation type: causes, fixes, contradicts, relates_to, part_of, depends_on, supersedes, similar_to'),
      namespace: z.string().optional().describe('Namespace (default: config default)'),
      weight: z.number().min(0).max(1).optional().describe('Relation strength 0-1 (default: 1.0)'),
      metadata: z.record(z.unknown()).optional().describe('Arbitrary metadata'),
      valid_from: z.string().optional().describe('ISO 8601 timestamp when relation becomes valid'),
      valid_to: z.string().optional().describe('ISO 8601 timestamp when relation stops being valid'),
    },
  }, (args) => {
    const relation = createRelation(args, db, config, logger, metrics);
    return textResult(relation);
  });

  // ─── Tool 12: query_graph (pass-through) ─────────────────────────
  server.registerTool('query_graph', {
    description: 'Traverse the knowledge graph starting from an entity.',
    inputSchema: {
      entity_id: z.string().optional().describe('Start entity ID'),
      entity_name: z.string().optional().describe('Start entity name (will find closest match)'),
      namespace: z.string().optional().describe('Namespace (default: config default)'),
      max_depth: z.number().int().min(1).max(5).optional().describe('Maximum traversal depth (default: 2)'),
      relation_types: z.array(z.string()).optional().describe('Filter by relation types'),
      valid_at: z.string().optional().describe('ISO 8601 timestamp — only show relations valid at this time'),
      limit: z.number().int().min(1).max(200).optional().describe('Maximum nodes to return (default: 50)'),
    },
  }, (args) => {
    const result = queryGraph(args, db, config, logger, metrics);
    return textResult(result);
  });

  // ─── Tool 13: search_claims (pass-through) ───────────────────────
  server.registerTool('search_claims', {
    description: 'Search atomic claims extracted from memories.',
    inputSchema: {
      query: z.string().optional().describe('Search text (matches content, subject, or object)'),
      memory_id: z.string().optional().describe('Get all claims from a specific memory'),
      limit: z.number().int().min(1).max(100).optional().describe('Max results (default: 20)'),
    },
  }, (args) => {
    if (args.memory_id !== undefined) {
      const claims = getClaimsForMemory(db, args.memory_id);
      return textResult(claims);
    }
    const claims = searchClaims(db, args.query ?? '', args.limit ?? 20);
    return textResult(claims);
  });

  // ─── neuromcp resources and prompts ──────────────────────────────
  registerResources(server, deps);
  registerPrompts(server, deps);

  // ─── hive-mind tools and resources ───────────────────────────────
  registerHiveTools(server, db, hiveConfig.defaultNamespace);
  registerHiveResources(server, db, hiveConfig.defaultNamespace);

  logger.info('server', 'hive-mind MCP server created', {
    tools: 16, // 13 neuromcp + 3 hive-mind
    agent: agentId,
    namespace: hiveConfig.defaultNamespace,
  });

  return server;
}
