#!/usr/bin/env node
import { main } from '../dist/index.js';

main(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  process.stderr.write(`Fatal error: ${message}\n`);
  if (stack !== undefined) {
    process.stderr.write(`${stack}\n`);
  }
  process.exit(1);
});
