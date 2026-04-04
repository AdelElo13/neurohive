# hive-mind

Multi-agent memory intelligence — shared knowledge, expertise tracking, and conflict detection for AI agent teams.

![npm version](https://img.shields.io/npm/v/@adel13/hive-mind)
![license](https://img.shields.io/npm/l/@adel13/hive-mind)
![node](https://img.shields.io/node/v/@adel13/hive-mind)

## Why

AI agents in teams forget everything and don't share knowledge. Multiple agents working on the same project re-discover the same facts, contradict each other, and have no collective memory. One agent learns the API timeout is 30 seconds; another assumes 60. Both conclusions sit in separate sessions, never compared.

**hive-mind** wraps neuromcp with a shared intelligence layer. Every memory stored by any agent becomes visible to the team. Searches come back annotated with who discovered what and when. New agents onboard with the team's existing knowledge already loaded. Contradictions get flagged before they cause incidents.

## Before & After

| | neuromcp alone | With hive-mind |
|---|---|---|
| Agent knowledge | Isolated per session | Shared across team, attributed |
| Search results | Raw results | Annotated with "discovered by Agent-X, 3 min ago" |
| New agent onboarding | Starts from zero | Primed with team's top knowledge |
| Expertise | Unknown who knows what | Tracked: "Agent-Backend: API (31), Auth (22)" |
| Contradictions | Silently coexist | Flagged: "Backend says 30s timeout, DevOps says 60s" |
| Team overview | None | Dashboard with knowledge map, gaps, activity |

## Quick Start

```
npx @adel13/hive-mind
```

Drop-in replacement for `npx neuromcp`. Use the same MCP config — just swap the command. All neuromcp tools and resources are available unchanged, plus three new hive-mind tools, five new resources, and automatic cross-agent annotation.

## Features

### Cross-Agent Annotations

Every search result is annotated with provenance: which agent stored it, how long ago, and how many times it's been retrieved. Agents can see at a glance whether a memory came from a trusted teammate or an unknown source.

### Agent Priming

When an agent starts up, it reads the `hivemind://priming` resource to load the team's top knowledge, recent activity, and known gaps. No cold starts.

### Expertise Tracking

Every time an agent stores a memory, hive-mind updates that agent's expertise profile — tracking which categories they contribute to most. Use `hivemind_expertise` to route questions: "who knows the most about authentication?"

### Conflict Detection

When two agents store contradictory claims about the same fact, hive-mind flags it as a conflict. Conflicts surface in `hivemind_conflicts` and in the dashboard so the team can resolve them explicitly rather than letting stale data propagate silently.

### Dashboard

A single command gives a live view of the collective knowledge base: total memories, active agents, top categories, recent activity, unresolved conflicts, and knowledge gaps.

## Installation

### Claude Code

```json
{
  "mcpServers": {
    "hive-mind": {
      "command": "npx",
      "args": ["@adel13/hive-mind"],
      "env": {
        "HIVEMIND_COMPANY": "my-project",
        "HIVEMIND_AGENT": "Agent-Backend",
        "HIVEMIND_AGENT_ROLE": "backend"
      }
    }
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "hive-mind": {
      "command": "npx",
      "args": ["-y", "@adel13/hive-mind"],
      "env": {
        "HIVEMIND_COMPANY": "my-project",
        "HIVEMIND_AGENT": "Agent-Frontend"
      }
    }
  }
}
```

### Cursor

```json
{
  "mcpServers": {
    "hive-mind": {
      "command": "npx",
      "args": ["@adel13/hive-mind"],
      "env": {
        "HIVEMIND_COMPANY": "my-project",
        "HIVEMIND_AGENT": "Cursor-Agent"
      }
    }
  }
}
```

### Paperclip Mode

When [Paperclip](https://github.com/paperclipai/paperclip) is running locally, hive-mind detects it automatically and reads the company, agent, and role from the Paperclip API. No extra env vars needed — the company namespace is set from the active Paperclip company, and each agent is identified by its Paperclip identity.

Manual fallback (when Paperclip is not running):

```
HIVEMIND_PAPERCLIP_URL=http://localhost:3100   # default
HIVEMIND_COMPANY=my-project
HIVEMIND_AGENT=Agent-Backend
HIVEMIND_AGENT_ROLE=backend
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `hive-mind` | Start as MCP server (stdio) |
| `hive-mind dashboard` | Print team knowledge dashboard |
| `hive-mind expertise [topic\|agent_id]` | Show expertise map or look up a topic/agent |
| `hive-mind conflicts [--all]` | List unresolved conflicts (--all includes resolved) |
| `hive-mind doctor` | Health check: DB path, agent config, Paperclip status |

## Configuration

### hive-mind variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HIVEMIND_COMPANY` | `""` | Company/project name. Sets the shared namespace to `company-<name>` |
| `HIVEMIND_AGENT` | `""` | Agent identifier (e.g. `Agent-Backend`, `Agent-DevOps`) |
| `HIVEMIND_AGENT_ROLE` | `""` | Agent role label for priming context |
| `HIVEMIND_PAPERCLIP_URL` | `http://localhost:3100` | Paperclip API URL for auto-detection |
| `HIVEMIND_PRIMING_COUNT` | `10` | Number of top memories to include in priming context |
| `HIVEMIND_PRIMING_CATEGORIES` | `""` | Comma-separated categories to prioritize in priming |

### neuromcp pass-through

All `NEUROMCP_*` environment variables pass through unchanged. Key ones:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEUROMCP_DB_PATH` | `~/.neuromcp/memory.db` | SQLite database path |
| `NEUROMCP_LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `NEUROMCP_EMBEDDING_PROVIDER` | `local` | Embedding provider: `local`, `openai`, `ollama` |
| `OPENAI_API_KEY` | — | Required when using OpenAI embeddings |

## MCP Surface

hive-mind exposes 16 tools, 18 resources, and 3 prompts.

### Tools

**13 neuromcp tools (unchanged):**

| Tool | Description |
|------|-------------|
| `store_memory` | Store memory with hive annotations |
| `search_memory` | Hybrid search with cross-agent attribution |
| `recall_memory` | Recall by ID, namespace, category, or tags |
| `forget_memory` | Soft-delete memories by filter |
| `consolidate` | Merge duplicates, decay stale, prune low-value |
| `memory_stats` | Count, category, and trust-level statistics |
| `export_memories` | Export as JSONL or JSON |
| `import_memories` | Import with deduplication |
| `backfill_embeddings` | Recompute missing embeddings |
| `create_entity` | Create/update knowledge graph entity |
| `create_relation` | Link entities in knowledge graph |
| `query_graph` | Traverse knowledge graph |
| `search_claims` | Search atomic extracted claims |

**3 hive-mind tools:**

| Tool | Description |
|------|-------------|
| `hivemind_status` | Team dashboard: agents, categories, conflicts, activity |
| `hivemind_expertise` | Query who knows what; get agent expertise profiles |
| `hivemind_conflicts` | List/resolve inter-agent contradictions |

### Resources

**13 neuromcp resources** (memory, graph, priming, stats) plus **5 hive-mind resources:**

| Resource URI | Description |
|---|---|
| `hivemind://priming` | Startup context: dashboard + top knowledge for onboarding |
| `hivemind://expertise` | All agent expertise data as JSON |
| `hivemind://conflicts` | Unresolved conflicts as JSON |
| `hivemind://dashboard` | Full dashboard data as JSON |
| `hivemind://agent/{agentId}` | Expertise profile for a specific agent |

### Prompts

3 neuromcp prompts: `store_memory_prompt`, `search_memory_prompt`, `session_summary_prompt`.

## Paperclip Integration

hive-mind probes `HIVEMIND_PAPERCLIP_URL` on startup. If the Paperclip API responds:

1. **Namespace** is set to `company-<companyId>` — all agents on the same Paperclip company share one knowledge base.
2. **Agent identity** is read from the Paperclip agent record, so each agent in a fleet is automatically identified.
3. **Role** is pulled from the agent definition, used to enrich priming context ("you are the backend agent; here's what your team knows").

If Paperclip is not running, hive-mind falls back to `HIVEMIND_COMPANY` / `HIVEMIND_AGENT` env vars with no loss of functionality.

## Requirements

| Requirement | Required | Notes |
|-------------|----------|-------|
| Node.js >= 18 | Yes | ESM runtime |
| neuromcp | Yes | Installed automatically as a dependency |
| Paperclip | No | Auto-detected when running at the configured URL |
| OpenAI API key | No | Only if using OpenAI embeddings |

## Platform Support

| Platform | Status |
|----------|--------|
| macOS | Full support |
| Linux | Full support |
| WSL2 | Supported |
| Windows (native) | Not supported |

## FAQ

**Is this a replacement for neuromcp?**
Yes and no. hive-mind runs on top of neuromcp and re-exports all its tools, resources, and prompts. If you run a single agent, it's functionally identical to neuromcp with a few extra tools. The value emerges with two or more agents sharing the same `HIVEMIND_COMPANY` namespace.

**Do all agents share one database?**
Yes — agents in the same company namespace share a database via the shared filesystem path (`NEUROMCP_DB_PATH`). This works naturally in multi-agent setups on the same machine (Paperclip, dmux, parallel Claude Code sessions). For distributed setups, point all agents to a shared NFS or networked path.

**What counts as a conflict?**
When two memories from different agents make contradictory claims about the same subject. Conflict detection runs at store time using the cognitive claims extracted from memory content. You can tune sensitivity or disable it via the neuromcp config.

**Will it break my existing neuromcp setup?**
No. hive-mind passes all existing `NEUROMCP_*` env vars through unchanged and writes to the same database. Switching back to `npx neuromcp` works at any time.

**How does priming work?**
At startup, agents that read `hivemind://priming` receive a formatted summary: team size, top categories, most active agents, recent memories, and any open conflicts. This is designed to be included in a system prompt or read via a hook on session start.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [LICENSE](./LICENSE).
