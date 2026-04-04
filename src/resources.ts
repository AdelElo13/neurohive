import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type Database from 'better-sqlite3';
import { getDashboardData, formatDashboard } from './dashboard.js';
import { getAllExpertise, getAgentProfile } from './tracker.js';
import { getConflicts } from './conflicts.js';

export function registerHiveResources(
  server: McpServer,
  db: Database.Database,
  namespace: string,
): void {
  // ─── Resource 1: hivemind://priming ──────────────────────────────
  server.registerResource('hive_priming', 'hivemind://priming', {
    description: 'Priming context: formatted dashboard as a quick overview for agent startup',
    mimeType: 'text/plain',
  }, () => {
    const data = getDashboardData(db, namespace);
    const formatted = formatDashboard(data);
    return {
      contents: [{
        uri: 'hivemind://priming',
        mimeType: 'text/plain',
        text: formatted,
      }],
    };
  });

  // ─── Resource 2: hivemind://expertise ────────────────────────────
  server.registerResource('hive_expertise', 'hivemind://expertise', {
    description: 'All agent expertise data as JSON',
    mimeType: 'application/json',
  }, () => {
    const expertise = getAllExpertise(db);
    return {
      contents: [{
        uri: 'hivemind://expertise',
        mimeType: 'application/json',
        text: JSON.stringify(expertise),
      }],
    };
  });

  // ─── Resource 3: hivemind://conflicts ────────────────────────────
  server.registerResource('hive_conflicts', 'hivemind://conflicts', {
    description: 'Unresolved inter-agent conflicts as JSON',
    mimeType: 'application/json',
  }, () => {
    const conflicts = getConflicts(db);
    return {
      contents: [{
        uri: 'hivemind://conflicts',
        mimeType: 'application/json',
        text: JSON.stringify(conflicts),
      }],
    };
  });

  // ─── Resource 4: hivemind://dashboard ────────────────────────────
  server.registerResource('hive_dashboard', 'hivemind://dashboard', {
    description: 'Full dashboard data as JSON',
    mimeType: 'application/json',
  }, () => {
    const data = getDashboardData(db, namespace);
    return {
      contents: [{
        uri: 'hivemind://dashboard',
        mimeType: 'application/json',
        text: JSON.stringify(data),
      }],
    };
  });

  // ─── Resource 5: hivemind://agent/{agentId} ──────────────────────
  server.registerResource(
    'hive_agent_profile',
    new ResourceTemplate('hivemind://agent/{agentId}', { list: undefined }),
    {
      description: 'Expertise profile for a specific agent',
      mimeType: 'application/json',
    },
    (uri: URL, variables: Record<string, string | string[]>) => {
      const agentId = typeof variables.agentId === 'string'
        ? variables.agentId
        : variables.agentId[0];
      const profile = getAgentProfile(db, agentId);
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(profile),
        }],
      };
    },
  );
}
