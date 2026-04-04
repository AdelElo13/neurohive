import type Database from 'better-sqlite3';

export interface DashboardData {
  readonly namespace: string;
  readonly totalMemories: number;
  readonly agents: readonly { agent_id: string; memory_count: number }[];
  readonly categories: readonly { category: string; count: number }[];
  readonly recentActivity: readonly { agent_id: string | null; content: string; created_at: string }[];
  readonly conflicts: number;
}

const BAR_WIDTH = 12;

export function getDashboardData(db: Database.Database, namespace: string): DashboardData {
  const totalRow = db
    .prepare<[string], { total: number }>(
      `SELECT COUNT(*) AS total FROM memories WHERE namespace = ? AND is_deleted = 0`,
    )
    .get(namespace);

  const totalMemories = totalRow?.total ?? 0;

  const agents = db
    .prepare<[string], { agent_id: string; memory_count: number }>(
      `SELECT agent_id, COUNT(*) AS memory_count
       FROM memories
       WHERE namespace = ? AND is_deleted = 0
       GROUP BY agent_id
       ORDER BY memory_count DESC`,
    )
    .all(namespace);

  const categories = db
    .prepare<[string], { category: string; count: number }>(
      `SELECT category, COUNT(*) AS count
       FROM memories
       WHERE namespace = ? AND is_deleted = 0
       GROUP BY category
       ORDER BY count DESC`,
    )
    .all(namespace);

  const recentActivity = db
    .prepare<[string], { agent_id: string | null; content: string; created_at: string }>(
      `SELECT agent_id, content, created_at
       FROM memories
       WHERE namespace = ? AND is_deleted = 0
       ORDER BY created_at DESC
       LIMIT 10`,
    )
    .all(namespace);

  const conflictsRow = db
    .prepare<[], { total: number }>(
      `SELECT COUNT(*) AS total FROM hive_conflicts WHERE resolved = 0`,
    )
    .get();

  const conflicts = conflictsRow?.total ?? 0;

  return {
    namespace,
    totalMemories,
    agents,
    categories,
    recentActivity,
    conflicts,
  };
}

function buildBar(count: number, max: number): string {
  const filled = max === 0 ? 0 : Math.round((count / max) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function formatDashboard(data: DashboardData): string {
  const lines: string[] = [];

  lines.push(`=== Hive Mind Dashboard: ${data.namespace} ===`);
  lines.push(`Total memories: ${data.totalMemories}`);
  lines.push('');

  lines.push('--- Agents ---');
  if (data.agents.length === 0) {
    lines.push('  (no agents)');
  } else {
    for (const agent of data.agents) {
      lines.push(`  ${agent.agent_id}: ${agent.memory_count} memories`);
    }
  }
  lines.push('');

  lines.push('--- Knowledge Map ---');
  const maxCount = data.categories.reduce((m, c) => Math.max(m, c.count), 0);
  if (data.categories.length === 0) {
    lines.push('  (no categories)');
  } else {
    for (const cat of data.categories) {
      const bar = buildBar(cat.count, maxCount);
      lines.push(`  ${cat.category.padEnd(20)} ${bar} ${cat.count}`);
    }
  }
  lines.push('');

  lines.push('--- Recent Activity ---');
  const recent = data.recentActivity.slice(0, 5);
  if (recent.length === 0) {
    lines.push('  (no recent activity)');
  } else {
    for (const entry of recent) {
      const agent = entry.agent_id ?? 'unknown';
      const content =
        entry.content.length > 60 ? entry.content.slice(0, 57) + '...' : entry.content;
      lines.push(`  [${agent}] ${content}`);
    }
  }

  if (data.conflicts > 0) {
    lines.push('');
    lines.push(`⚠ WARNING: ${data.conflicts} unresolved conflict${data.conflicts === 1 ? '' : 's'} detected`);
  }

  return lines.join('\n');
}
