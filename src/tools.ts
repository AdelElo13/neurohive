import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { getDashboardData, formatDashboard } from './dashboard.js';
import { getTopExperts, getAgentProfile, getAllExpertise } from './tracker.js';
import { getConflicts, resolveConflict } from './conflicts.js';

function textResult(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
}

export function registerHiveTools(
  server: McpServer,
  db: Database.Database,
  namespace: string,
): void {
  // ─── Tool 1: hivemind_status ─────────────────────────────────────
  server.registerTool('hivemind_status', {
    description: 'Get the neurohive dashboard: total memories, agents, categories, recent activity, and conflict count.',
    inputSchema: {},
  }, () => {
    const data = getDashboardData(db, namespace);
    const formatted = formatDashboard(data);
    return {
      content: [
        { type: 'text', text: formatted },
        { type: 'text', text: JSON.stringify(data) },
      ],
    };
  });

  // ─── Tool 2: hivemind_expertise ──────────────────────────────────
  server.registerTool('hivemind_expertise', {
    description: 'Query agent expertise. Provide a topic to find top experts, an agent_id to see their profile, or neither for all expertise.',
    inputSchema: {
      topic: z.string().optional().describe('Topic to search for experts'),
      agent_id: z.string().optional().describe('Agent ID to get expertise profile'),
      limit: z.number().int().min(1).max(50).optional().describe('Max results (default: 5)'),
    },
  }, (args) => {
    if (args.agent_id !== undefined) {
      const profile = getAgentProfile(db, args.agent_id);
      return textResult(profile);
    }

    if (args.topic !== undefined) {
      const experts = getTopExperts(db, args.topic, args.limit ?? 5);
      return textResult(experts);
    }

    const all = getAllExpertise(db);
    return textResult(all);
  });

  // ─── Tool 3: hivemind_conflicts ──────────────────────────────────
  server.registerTool('hivemind_conflicts', {
    description: 'List unresolved conflicts between agent memories, or resolve a specific conflict by ID.',
    inputSchema: {
      resolve_id: z.string().optional().describe('Conflict ID to mark as resolved'),
      include_resolved: z.boolean().optional().describe('Include resolved conflicts (default: false)'),
    },
  }, (args) => {
    if (args.resolve_id !== undefined) {
      resolveConflict(db, args.resolve_id);
      return textResult({ resolved: args.resolve_id });
    }

    const conflicts = getConflicts(db, {
      includeResolved: args.include_resolved ?? false,
    });
    return textResult(conflicts);
  });
}
