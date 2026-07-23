---
name: coding-agent
description: 'Delegate coding tasks to Codex, Claude Code, or Pi agents via acpx (ACP protocol). Use when: (1) building/creating new features or apps, (2) reviewing PRs (spawn in temp dir), (3) refactoring large codebases, (4) iterative coding that needs file exploration. NOT for: simple one-liner fixes (just edit), reading code (use read tool), thread-bound ACP harness requests in chat (for example spawn/run Codex or Claude Code in a Discord thread; use sessions_spawn with runtime:"acp"), or any work in ~/clawd workspace (never spawn agents here). Prefer acpx over raw PTY/exec for all coding agent delegation.'
metadata:
  {
    "openclaw": { "emoji": "🧩", "requires": { "anyBins": ["acpx", "claude", "codex", "opencode", "pi"] } },
  }
---

# Coding Agent (acpx-first)

Use **acpx** for all coding agent work. It communicates over the Agent Client Protocol (ACP) — no PTY scraping, structured output, persistent sessions.

```bash
# Install (already global on this system)
npm i -g acpx
```

## ✅ Primary: acpx (preferred for all agents)

```bash
# One-shot (exec) — no session state saved
acpx codex exec "summarize this repo"
acpx claude exec "refactor the auth module"

# Persistent session (prompt) — reuses session per cwd
acpx codex "fix the failing tests"
acpx claude "add error handling to API calls"

# Named parallel sessions
acpx codex -s backend "refactor the API layer"
acpx codex -s frontend "update the React components"

# Auto-approve permissions
acpx --approve-all codex exec "run and fix failing tests"

# Fire-and-forget (background)
acpx --no-wait codex "long refactor task"

# Read prompt from file or stdin
acpx codex -f prompt.txt
cat prompt.md | acpx codex

# With working directory
acpx --cwd ~/Projects/myproject codex "fix the auth bug"
```

## Built-in agent registry

| Alias | Resolves to |
|-------|-------------|
| `codex` | `npx @zed-industries/codex-acp` |
| `claude` | `npx -y @zed-industries/claude-agent-acp` |
| `gemini` | `gemini --acp` |
| `opencode` | `npx -y opencode-ai acp` |
| `pi` | `npx pi-acp` |
| `kimi` | `kimi acp` |

Default agent is `codex`.

## Session management

```bash
acpx sessions                          # list sessions
acpx sessions new                      # create new session for current cwd
acpx sessions new --name backend       # named session
acpx sessions close backend            # close named session
acpx sessions history --limit 20       # turn history
acpx codex status                      # check if agent process is alive
acpx codex cancel                      # cancel in-flight turn
```

## ⚠️ Fallback: raw exec (only when acpx unavailable or unsupported)

For **Claude Code** (`claude` CLI), if acpx isn't working:

```bash
# ✅ Fallback for Claude Code (no PTY needed)
cd /path/to/project && claude --permission-mode bypassPermissions --print 'Your task'

# ❌ Wrong for Claude Code
bash pty:true command:"claude --dangerously-skip-permissions 'task'"
```

For **Codex/Pi/OpenCode** raw fallback (PTY required):

```bash
bash pty:true command:"codex exec 'Your prompt'"
```

---

## MCP Servers — Available in All Claude Code Sessions

Both MCP servers are pre-configured system-wide and connect automatically when running
`claude` from any workspace directory.

### jcodemunch-mcp — Code Exploration

**When to use:**
- Exploring an unfamiliar codebase before making changes
- Looking up function/class/symbol definitions
- Getting a file outline without reading the whole file
- Tracing call chains or finding symbol usage
- Any code task where you'd otherwise open and read multiple files

**Workflow:**
```bash
# 1. Index the project once (idempotent — safe to re-run)
# In Claude Code prompt: "Use jcodemunch to index this project first"

# Tools available inside Claude Code:
jcodemunch: index_codebase { "path": "/path/to/project" }
jcodemunch: list_projects {}
jcodemunch: get_file_outline { "path": "src/server.js" }
jcodemunch: search_symbols { "query": "handleAuth" }
jcodemunch: get_symbol { "symbol_id": "..." }
```

**Prompt pattern for Claude Code tasks:**
```
cd ~/project && claude --permission-mode bypassPermissions --print \
  'First index this project with jcodemunch, then use symbol search and outlines
   to explore the codebase. Do NOT read full files — use targeted retrieval.
   Task: <your task here>'
```

**Rules:**
- Always index before exploring a new project
- Use `get_file_outline` + `search_symbols` before reaching for `read`
- Re-index after major refactors; skip for routine work
- `list_projects` to avoid re-indexing already-indexed repos

---

### jdocmunch-mcp — Documentation Exploration

**When to use:**
- Exploring library/framework/API docs before implementing
- Finding config options, installation steps, API reference sections
- Onboarding to an unfamiliar tool
- Any task where you'd otherwise open and skim large README or doc files

**Workflow:**
```bash
# Tools available inside Claude Code:
jdocmunch: list_repos {}                                           # check indexed
jdocmunch: index_local { "path": "/path/to/docs" }                # index local docs
jdocmunch: index_repo { "url": "owner/repo" }                     # index GitHub repo
jdocmunch: get_toc_tree { "repo": "owner/repo" }                  # browse structure
jdocmunch: search_sections { "repo": "...", "query": "auth" }     # find sections
jdocmunch: get_section { "repo": "...", "section_id": "..." }     # read one section
jdocmunch: get_section_context { "repo": "...", "section_id": "..." } # section + context
```

**Pre-indexed docs** (already available — no need to re-index):
- OpenClaw docs: index with `index_local { "path": "/home/sean/.npm-global/lib/node_modules/openclaw/docs" }`

**Prompt pattern:**
```
claude --permission-mode bypassPermissions --print \
  'Use jdocmunch to index and explore the docs at <path/repo>.
   Use search_sections and get_section — do NOT read full doc files.
   Task: <your task here>'
```

**Rules:**
- Always `list_repos` before indexing — avoid duplicate indexes
- Pattern: `search_sections` → `get_section` (never open full files)
- Use `get_section_context` when you need surrounding structure
- `GITHUB_TOKEN`, `GOOGLE_API_KEY`, `OPENAI_API_KEY` are pre-configured for summaries + private repos

---

## Installed CLIs

| CLI | Version | Auth | Notes |
|-----|---------|------|-------|
| `claude` | 2.1.71 | OAuth | `--print --permission-mode bypassPermissions` |
| `codex` | 0.116.0 | OpenAI key (via ~/.bashrc) | `pty:true` required |
| `gemini` | 0.29.5 | Gemini API key | `pty:true` recommended |

---

## Bash Tool Parameters

| Parameter    | Type    | Description                                                                 |
| ------------ | ------- | --------------------------------------------------------------------------- |
| `command`    | string  | The shell command to run                                                    |
| `pty`        | boolean | **Use for coding agents!** Allocates a pseudo-terminal for interactive CLIs |
| `workdir`    | string  | Working directory (agent sees only this folder's context)                   |
| `background` | boolean | Run in background, returns sessionId for monitoring                         |
| `timeout`    | number  | Timeout in seconds (kills process on expiry)                                |
| `elevated`   | boolean | Run on host instead of sandbox (if allowed)                                 |

### Process Tool Actions (for background sessions)

| Action      | Description                                          |
| ----------- | ---------------------------------------------------- |
| `list`      | List all running/recent sessions                     |
| `poll`      | Check if session is still running                    |
| `log`       | Get session output (with optional offset/limit)      |
| `write`     | Send raw data to stdin                               |
| `submit`    | Send data + newline (like typing and pressing Enter) |
| `send-keys` | Send key tokens or hex bytes                         |
| `paste`     | Paste text (with optional bracketed mode)            |
| `kill`      | Terminate the session                                |

---

## Quick Start: One-Shot Tasks

```bash
# One-shot with acpx (preferred)
acpx --cwd ~/project codex exec "Your task"
acpx --cwd ~/project claude exec "Your task"

# With auto-approve
acpx --approve-all --cwd ~/project codex exec "Add error handling to the API calls"
```

---

## The Pattern: persistent sessions + background

For longer tasks, use persistent sessions or `--no-wait`:

```bash
# Create a named session and start work
cd ~/project
acpx codex sessions new --name myfeature
acpx codex -s myfeature "Build a snake game"

# Check status
acpx codex status -s myfeature
acpx codex sessions history myfeature --limit 10

# Fire-and-forget (returns immediately)
acpx --no-wait --cwd ~/project codex "Long refactor task"
```

---

## Reviewing PRs

**⚠️ CRITICAL: Never review PRs in OpenClaw's own project folder!**

```bash
# Clone to temp for safe review
REVIEW_DIR=$(mktemp -d)
git clone https://github.com/user/repo.git $REVIEW_DIR
acpx --approve-reads --cwd $REVIEW_DIR codex exec "Review this PR vs main branch and summarize issues"
```

---

## Parallel Sessions with git worktrees

```bash
git worktree add -b fix/issue-78 /tmp/issue-78 main
git worktree add -b fix/issue-99 /tmp/issue-99 main

acpx --approve-all --no-wait --cwd /tmp/issue-78 codex "Fix issue #78"
acpx --approve-all --no-wait --cwd /tmp/issue-99 codex "Fix issue #99"

acpx codex sessions list
```

---

## Auto-Notify on Completion

Append to your prompt so OpenClaw gets notified when the agent finishes:

```
... your task here.

When completely finished, run:
openclaw system event --text "Done: [brief summary]" --mode now
```

---

## ⚠️ Rules

1. **Use acpx first**: Always prefer `acpx` over raw PTY/exec for coding agent delegation. Fall back to raw exec only if acpx is unavailable or the agent doesn't support ACP.
2. **Use MCP servers**: Always prompt Claude Code to use jcodemunch for code exploration and jdocmunch for doc exploration — never brute-force read files
3. **Respect tool choice** — if user asks for Codex, use Codex
4. **Be patient** — don't kill sessions because they're "slow"
5. **Monitor with process:log** — check progress without interfering
6. **Parallel is OK** — run many agents at once for batch work
7. **NEVER start Codex in ~/.openclaw/** — it'll read soul docs and get weird ideas about the org chart!
8. **NEVER checkout branches in ~/Projects/openclaw/** — that's the LIVE OpenClaw instance!

---

## Progress Updates

- Send 1 short message when you start (what's running + where)
- Update again only when: milestone completes, agent asks a question, error occurs, or agent finishes
- If you kill a session, immediately say why
