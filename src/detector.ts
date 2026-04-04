export interface PaperclipContext {
  readonly companyId: string;
  readonly companyName: string;
  readonly agentId: string;
  readonly agentRole: string;
}

/**
 * Parses a Paperclip health response and extracts context.
 *
 * @param data - The unknown data to parse
 * @returns Parsed context or null if invalid
 */
export function parsePaperclipContext(data: unknown): PaperclipContext | null {
  // Type guard: must be an object
  if (
    typeof data !== 'object' ||
    data === null ||
    Array.isArray(data)
  ) {
    return null;
  }

  const record = data as Record<string, unknown>;

  // Status must be 'ok'
  if (record.status !== 'ok') {
    return null;
  }

  // Company must exist and have id and name
  if (typeof record.company !== 'object' || record.company === null) {
    return null;
  }

  const company = record.company as Record<string, unknown>;
  if (typeof company.id !== 'string' || typeof company.name !== 'string') {
    return null;
  }

  // Agent is optional; if missing or incomplete, use empty strings
  let agentId = '';
  let agentRole = '';

  if (typeof record.agent === 'object' && record.agent !== null) {
    const agent = record.agent as Record<string, unknown>;
    if (typeof agent.id === 'string') {
      agentId = agent.id;
    }
    if (typeof agent.role === 'string') {
      agentRole = agent.role;
    }
  }

  return {
    companyId: company.id,
    companyName: company.name,
    agentId,
    agentRole,
  };
}

/**
 * Detects a running Paperclip instance by making an HTTP request to /health.
 *
 * @param url - The base URL of the Paperclip instance (e.g., http://localhost:3100)
 * @returns Parsed context or null on any error (best-effort)
 */
export async function detectPaperclip(
  url: string
): Promise<PaperclipContext | null> {
  try {
    const healthUrl = `${url}/health`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    try {
      const response = await fetch(healthUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return parsePaperclipContext(data);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    // Silently fail: best-effort detection
    return null;
  }
}
