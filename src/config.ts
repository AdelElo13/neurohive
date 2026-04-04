import { loadConfig, type NeuromcpConfig } from 'neuromcp/config';

export interface HiveConfig extends NeuromcpConfig {
  readonly paperclipUrl: string;
  readonly hiveCompany: string;
  readonly hiveAgent: string;
  readonly hiveAgentRole: string;
  readonly primingCount: number;
  readonly primingCategories: readonly string[];
}

export function loadHiveConfig(): HiveConfig {
  const base = loadConfig();
  const hiveCompany = process.env.HIVEMIND_COMPANY ?? '';
  const hiveAgent = process.env.HIVEMIND_AGENT ?? '';

  return {
    ...base,
    defaultNamespace: hiveCompany ? `company-${hiveCompany}` : base.defaultNamespace,
    paperclipUrl: process.env.HIVEMIND_PAPERCLIP_URL ?? 'http://localhost:3100',
    hiveCompany,
    hiveAgent,
    hiveAgentRole: process.env.HIVEMIND_AGENT_ROLE ?? '',
    primingCount: parseInt(process.env.HIVEMIND_PRIMING_COUNT ?? '10', 10),
    primingCategories: (process.env.HIVEMIND_PRIMING_CATEGORIES ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
