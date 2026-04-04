import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadHiveConfig } from './config.js';
import { createLogger } from 'neuromcp/observability/logger';
import { createMetrics } from 'neuromcp/observability/metrics';
import { openDatabase } from 'neuromcp/storage/database';
import { runMigrations } from 'neuromcp/storage/migrations';
import { SqliteVecStore } from 'neuromcp/vectors/sqlite-vec';
import { createEmbeddingProvider } from 'neuromcp/embeddings/factory';
import { detectPaperclip } from './detector.js';
import { runHiveMigrations } from './schema.js';
import { createHiveServer } from './server.js';
import { getDashboardData, formatDashboard } from './dashboard.js';
import { getTopExperts, getAgentProfile } from './tracker.js';
import { getConflicts } from './conflicts.js';

async function runCli(command: string, args: string[]): Promise<void> {
  const config = loadHiveConfig();
  const logger = createLogger({ level: config.logLevel, format: config.logFormat });
  const db = openDatabase(config.dbPath);
  runMigrations(db, config.dbPath, logger);
  runHiveMigrations(db);

  switch (command) {
    case 'dashboard': {
      const data = getDashboardData(db, config.defaultNamespace);
      const formatted = formatDashboard(data);
      process.stdout.write(formatted + '\n');
      break;
    }

    case 'expertise': {
      const target = args[0];
      if (target !== undefined) {
        // Could be a topic or an agent_id; try agent profile first
        const profile = getAgentProfile(db, target);
        if (profile.length > 0) {
          process.stdout.write(JSON.stringify(profile, null, 2) + '\n');
        } else {
          const experts = getTopExperts(db, target);
          process.stdout.write(JSON.stringify(experts, null, 2) + '\n');
        }
      } else {
        const experts = getTopExperts(db, '', 10);
        process.stdout.write(JSON.stringify(experts, null, 2) + '\n');
      }
      break;
    }

    case 'conflicts': {
      const conflicts = getConflicts(db, { includeResolved: args.includes('--all') });
      process.stdout.write(JSON.stringify(conflicts, null, 2) + '\n');
      break;
    }

    case 'doctor': {
      const paperclip = await detectPaperclip(config.paperclipUrl);
      process.stdout.write('hive-mind doctor\n');
      process.stdout.write(`  DB path:     ${config.dbPath}\n`);
      process.stdout.write(`  Namespace:   ${config.defaultNamespace}\n`);
      process.stdout.write(`  Agent:       ${config.hiveAgent || '(not set)'}\n`);
      process.stdout.write(`  Agent role:  ${config.hiveAgentRole || '(not set)'}\n`);
      process.stdout.write(`  Paperclip:   ${paperclip !== null ? `connected (company: ${paperclip.companyName})` : 'not detected'}\n`);
      process.stdout.write(`  Company:     ${config.hiveCompany || '(not set)'}\n`);
      break;
    }

    default: {
      process.stderr.write(`Unknown command: ${command}\n`);
      process.stderr.write('Usage: hive-mind [dashboard|expertise|conflicts|doctor]\n');
      process.exitCode = 1;
    }
  }
}

async function startServer(): Promise<void> {
  const hiveConfig = loadHiveConfig();
  const logger = createLogger({ level: hiveConfig.logLevel, format: hiveConfig.logFormat });
  const metrics = createMetrics();

  logger.info('startup', 'Loading hive-mind v1.0.0', {
    dbPath: hiveConfig.dbPath,
    defaultNamespace: hiveConfig.defaultNamespace,
    agent: hiveConfig.hiveAgent,
    company: hiveConfig.hiveCompany,
  });

  // Detect Paperclip and override config if found
  const paperclip = await detectPaperclip(hiveConfig.paperclipUrl);

  const effectiveConfig = paperclip !== null
    ? {
        ...hiveConfig,
        defaultNamespace: `company-${paperclip.companyId}`,
        hiveCompany: paperclip.companyName,
        hiveAgent: paperclip.agentId || hiveConfig.hiveAgent,
        hiveAgentRole: paperclip.agentRole || hiveConfig.hiveAgentRole,
      }
    : hiveConfig;

  if (paperclip !== null) {
    logger.info('startup', 'Paperclip detected, overriding config', {
      company: paperclip.companyName,
      agent: paperclip.agentId,
      namespace: effectiveConfig.defaultNamespace,
    });
  }

  // Open database and run migrations
  const db = openDatabase(effectiveConfig.dbPath);
  runMigrations(db, effectiveConfig.dbPath, logger);
  runHiveMigrations(db);

  // Initialize embedding provider and vector store
  const embedder = await createEmbeddingProvider(effectiveConfig, logger);
  const vecStore = new SqliteVecStore(embedder.dimensions);
  vecStore.initialize(db);

  // Create hive-mind MCP server
  const server = createHiveServer(
    { db, vecStore, embedder, config: effectiveConfig, logger, metrics },
    effectiveConfig,
  );

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('startup', 'hive-mind MCP server running on stdio');

  // Cleanup on exit
  const cleanup = (): void => {
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

export async function main(args: string[]): Promise<void> {
  const command = args[0];
  const cliCommands = ['dashboard', 'expertise', 'conflicts', 'doctor'];

  if (command !== undefined && cliCommands.includes(command)) {
    await runCli(command, args.slice(1));
  } else {
    await startServer();
  }
}

// Re-export for programmatic use
export { loadHiveConfig } from './config.js';
export { createHiveServer } from './server.js';
export { hiveStore, hiveSearch } from './wrappers.js';
