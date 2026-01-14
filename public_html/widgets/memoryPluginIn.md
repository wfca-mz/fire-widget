# Claude-Mem Memory Plugin - Reverse Engineered Guide

This document captures how the claude-mem plugin works based on reverse engineering and observation of the running system.

## Overview

Claude-mem is a persistent memory system for Claude Code that:
1. **Captures** tool usage and session context automatically
2. **Compresses** observations using AI (Claude Haiku)
3. **Injects** relevant context into new sessions
4. **Enables** semantic search across all past work

---

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE SESSION                          │
├─────────────────────────────────────────────────────────────────┤
│  SessionStart  →  UserPromptSubmit  →  PostToolUse  →  Stop     │
│       ↓                  ↓                  ↓            ↓       │
│  context-hook       new-hook           save-hook    summary-hook │
│  user-message-hook                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    WORKER SERVICE (PM2)                          │
│                    Port 37777 (HTTP API)                         │
├─────────────────────────────────────────────────────────────────┤
│  - Receives tool output from hooks                               │
│  - Generates compressed observations via Claude Haiku            │
│  - Stores in SQLite database                                     │
│  - Syncs to ChromaDB for vector search                           │
│  - Serves web viewer UI                                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  SQLite: ~/.claude-mem/claude-mem.db                             │
│    - observations (main facts/learnings)                         │
│    - session_summaries (end-of-session summaries)                │
│    - user_prompts (raw user messages)                            │
│    - FTS5 indexes for full-text search                           │
│                                                                  │
│  ChromaDB: ~/.claude-mem/chroma/                                 │
│    - Vector embeddings for semantic search                       │
└─────────────────────────────────────────────────────────────────┘
```

### File Locations

| Component | Location |
|-----------|----------|
| Plugin Source | `~/.claude/plugins/marketplaces/thedotmack/` |
| Installed Scripts | `~/.claude/plugins/cache/thedotmack/claude-mem/<version>/scripts/` |
| Database | `~/.claude-mem/claude-mem.db` |
| Settings | `~/.claude-mem/settings.json` |
| Chroma Vectors | `~/.claude-mem/chroma/` |
| Worker Logs | `~/.claude-mem/silent.log` |

---

## Lifecycle Hooks

The plugin registers 5 lifecycle hooks that fire at different points:

### 1. SessionStart (startup|clear|compact)
**Scripts**: `context-hook.js`, `user-message-hook.js`

**Purpose**: Inject context into new sessions
- Fetches recent observations from database
- Injects them as system context
- Default: 50 most recent observations for current project

### 2. UserPromptSubmit
**Script**: `new-hook.js`

**Purpose**: Track user messages
- Creates/updates session record
- Saves raw user prompt to `user_prompts` table

### 3. PostToolUse (*)
**Script**: `save-hook.js`

**Purpose**: Capture tool output
- Triggers on ALL tool calls (Read, Write, Bash, etc.)
- Sends tool output to worker service
- Worker compresses into observation via Claude Haiku
- Skipped tools: `ListMcpResourcesTool, SlashCommand, Skill, TodoWrite, AskUserQuestion`

### 4. Stop
**Script**: `summary-hook.js`

**Purpose**: Generate session summary
- Creates end-of-session summary
- Captures: request, investigated, learned, completed, next_steps
- Stored in `session_summaries` table

### 5. SessionEnd
**Script**: `cleanup-hook.js`

**Purpose**: Cleanup and finalization

---

## Database Schema

### observations (main table)

```sql
CREATE TABLE observations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sdk_session_id TEXT NOT NULL,      -- Links to session
    project TEXT NOT NULL,              -- Project directory name
    text TEXT,                          -- Original tool output (truncated)
    type TEXT NOT NULL,                 -- decision|bugfix|feature|refactor|discovery|change
    title TEXT,                         -- Short title (AI-generated)
    subtitle TEXT,                      -- One-line summary
    facts TEXT,                         -- JSON array of facts
    narrative TEXT,                     -- Detailed explanation (AI-generated)
    concepts TEXT,                      -- JSON array of concept tags
    files_read TEXT,                    -- Files mentioned
    files_modified TEXT,                -- Files changed
    prompt_number INTEGER,              -- Which prompt in session
    created_at TEXT NOT NULL,
    created_at_epoch INTEGER NOT NULL
);
```

**Observation Types**:
- `decision` - Architectural/design decisions
- `bugfix` - Bug fixes
- `feature` - New features added
- `refactor` - Code refactoring
- `discovery` - Codebase discoveries/learnings
- `change` - General code changes

**Concept Tags**:
- `how-it-works` - Implementation details
- `why-it-exists` - Rationale/motivation
- `what-changed` - Description of changes
- `problem-solution` - Problem and its solution
- `gotcha` - Pitfalls/warnings
- `pattern` - Design patterns
- `trade-off` - Trade-off decisions

### session_summaries

```sql
CREATE TABLE session_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sdk_session_id TEXT NOT NULL,
    project TEXT NOT NULL,
    request TEXT,              -- What user asked for
    investigated TEXT,         -- What was explored
    learned TEXT,              -- Key learnings
    completed TEXT,            -- What was accomplished
    next_steps TEXT,           -- Suggested follow-up
    files_read TEXT,
    files_edited TEXT,
    notes TEXT,
    prompt_number INTEGER,
    created_at TEXT NOT NULL,
    created_at_epoch INTEGER NOT NULL
);
```

### user_prompts

```sql
CREATE TABLE user_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sdk_session_id TEXT NOT NULL,
    project TEXT NOT NULL,
    prompt TEXT NOT NULL,      -- Raw user message
    prompt_number INTEGER,
    created_at TEXT NOT NULL,
    created_at_epoch INTEGER NOT NULL
);
```

---

## Search Tools (MCP)

Claude-mem exposes search via MCP tools:

### Primary Search Tool
`mcp__plugin_claude-mem_claude-mem-search__search`

**Parameters**:
- `query` - Semantic search query (uses ChromaDB vectors)
- `type` - Filter: `observations`, `sessions`, `prompts`
- `project` - Filter by project name
- `obs_type` - Filter observation types
- `concepts` - Filter by concept tags
- `files` - Filter by file paths
- `dateStart/dateEnd` - Date range filter
- `format` - `index` (titles only) or `full` (complete records)
- `limit/offset` - Pagination

### Specialized Search Tools
- `decisions` - Find architectural decisions
- `changes` - Find code changes
- `how_it_works` - Find implementation details
- `timeline` - Get observations around a point in time
- `find_by_concept` - Filter by concept tags
- `find_by_file` - Filter by file paths
- `find_by_type` - Filter by observation type
- `get_recent_context` - Get recent activity

### Search Strategy

**Always use `format: "index"` first** (default):
1. Returns titles/dates only (~10x fewer tokens)
2. Review results to identify relevant items
3. Then use `format: "full"` for specific items of interest

---

## Configuration

Settings in `~/.claude-mem/settings.json`:

```json
{
  "CLAUDE_MEM_MODEL": "claude-haiku-4-5",           // AI model for compression
  "CLAUDE_MEM_CONTEXT_OBSERVATIONS": "50",          // Observations to inject
  "CLAUDE_MEM_WORKER_PORT": "37777",                // Worker HTTP port
  "CLAUDE_MEM_SKIP_TOOLS": "TodoWrite,Skill,...",   // Tools to ignore
  "CLAUDE_MEM_LOG_LEVEL": "INFO",                   // DEBUG|INFO|WARN|ERROR|SILENT

  // Context injection settings
  "CLAUDE_MEM_CONTEXT_SHOW_READ_TOKENS": "true",    // Show token costs
  "CLAUDE_MEM_CONTEXT_OBSERVATION_TYPES": "bugfix,feature,refactor,discovery,decision,change",
  "CLAUDE_MEM_CONTEXT_OBSERVATION_CONCEPTS": "how-it-works,why-it-exists,...",
  "CLAUDE_MEM_CONTEXT_FULL_COUNT": "5",             // Full narratives to show
  "CLAUDE_MEM_CONTEXT_FULL_FIELD": "narrative",     // Which field for full display
  "CLAUDE_MEM_CONTEXT_SESSION_COUNT": "10",         // Session summaries to show
  "CLAUDE_MEM_CONTEXT_SHOW_LAST_SUMMARY": "true"    // Include last session summary
}
```

---

## Worker Service

PM2-managed HTTP server on port 37777:

### Health Check
```bash
curl http://127.0.0.1:37777/health
# {"status":"ok","timestamp":...}
```

### Web Viewer
Open http://localhost:37777 in browser for visual memory browser.

### PM2 Commands
```bash
pm2 list                      # Check status
pm2 logs claude-mem-worker    # View logs
pm2 restart claude-mem-worker # Restart
pm2 delete claude-mem-worker  # Stop and remove
```

---

## Privacy Controls

### User Privacy Tag
Wrap sensitive content to prevent storage:
```
<private>sensitive content here</private>
```

### System Tag
Auto-injected context uses `<claude-mem-context>` tags to prevent recursive storage.

---

## Troubleshooting

### Quick Diagnostic
```bash
# Check worker health
curl -s http://127.0.0.1:37777/health

# Check database
sqlite3 ~/.claude-mem/claude-mem.db "SELECT COUNT(*) FROM observations;"

# Check PM2 status
pm2 list

# View worker logs
pm2 logs claude-mem-worker --lines 50
```

### Common Issues

**Nothing being saved**:
1. Check worker is running: `pm2 list`
2. Restart worker: `pm2 restart claude-mem-worker`
3. Check logs: `pm2 logs claude-mem-worker`

**Search returns empty**:
1. Verify data exists: `sqlite3 ~/.claude-mem/claude-mem.db "SELECT COUNT(*) FROM observations;"`
2. Try different search: use `format: "index"` and no filters first
3. Search by project: add `project: "your-project-name"` filter

**Version mismatch errors**:
1. Check installed version: `ls ~/.claude/plugins/cache/thedotmack/claude-mem/`
2. Reinstall: `/plugin install claude-mem`

---

## Practical Tips

### What Gets Captured
- Every tool call (Read, Write, Edit, Bash, Grep, Glob, etc.)
- User prompts
- Session summaries at end

### What Gets Skipped
- `TodoWrite`, `AskUserQuestion`, `Skill`, `SlashCommand`
- Tool calls wrapped in `<private>` tags

### Best Practices
1. **Let it run** - Memory builds over time automatically
2. **Use semantic search** - Query naturally: "how did we implement caching?"
3. **Filter by project** - Add `project: "project-name"` for focused results
4. **Check index first** - Use `format: "index"` before `format: "full"`
5. **Session summaries** - These capture the "why" and "what was learned"

### Example Searches

```
# What did we do last session?
mcp__search: { project: "wfca.local", type: "sessions", limit: 3 }

# How does the caching work?
mcp__how_it_works: { query: "caching implementation" }

# What decisions were made?
mcp__decisions: { query: "API design choices" }

# Changes to a specific file?
mcp__find_by_file: { files: "fire-widget.js" }
```

---

## Current Stats (This Installation)

```
Observations: 12,268
Session Summaries: 1,198
User Prompts: 1,397
```

For this project (wfca.local): 19 session summaries captured covering the entire widget development history.
