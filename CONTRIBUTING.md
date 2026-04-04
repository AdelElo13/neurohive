# Contributing to hive-mind

## Setup

```bash
git clone https://github.com/AdelElo13/hive-mind.git
cd hive-mind
npm install
```

## Development

```bash
npm run dev        # Run with tsx (no build step)
npm test           # Run test suite
npm run build      # Build to dist/
npm run lint       # TypeScript type check
```

## Project Structure

```
src/
  index.ts         # CLI entry + startServer
  server.ts        # createHiveServer — all 16 tools registered here
  config.ts        # loadHiveConfig — HIVEMIND_* + NEUROMCP_* env vars
  tools.ts         # registerHiveTools — 3 hive-specific tools
  resources.ts     # registerHiveResources — 5 hive-specific resources
  schema.ts        # SQLite migrations for hive tables
  tracker.ts       # Expertise tracking logic
  conflicts.ts     # Conflict detection and resolution
  dashboard.ts     # Dashboard data aggregation and formatting
  detector.ts      # Paperclip auto-detection
  primer.ts        # Agent priming helpers
  wrappers.ts      # hiveStore / hiveSearch wrappers around neuromcp

tests/             # Vitest unit tests mirroring src/
bin/
  cli.mjs          # Thin entry point for npx
```

## Adding a Feature

1. Write tests first (`tests/<module>.test.ts`)
2. Implement in `src/`
3. If adding a new tool: register in `server.ts` and update the tool count in the logger call
4. If adding a new resource: register in `resources.ts`
5. Run `npm test` and `npm run lint` before opening a PR

## Environment Variables

Set in a local `.env` file (not committed) for development:

```
HIVEMIND_COMPANY=dev
HIVEMIND_AGENT=dev-agent
NEUROMCP_DB_PATH=/tmp/hive-dev.db
NEUROMCP_LOG_LEVEL=debug
```

## Commit Style

Follow conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.

## Pull Requests

- Keep PRs focused — one feature or fix per PR
- Include tests for new functionality
- Update relevant documentation in `README.md` if the public interface changes

## License

By contributing, you agree that your contributions will be licensed under MIT.
