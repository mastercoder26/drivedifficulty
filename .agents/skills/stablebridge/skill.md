---
name: stablebridge
description: Setup and use stablebridge to generate Stability AI images and insert them into projects. Use when the user needs hero images, app icons, OG images, or any AI-generated visuals via Stability AI.
triggers:
  - stablebridge setup
  - Stability AI image
  - generate image
  - hero image
  - app icon
  - stablebridge
---

# stablebridge Agent Skill

Generate and insert Stability AI images into any project. **Your API key never enters this chat.**

Hosted URL: /skill.md

Install all skills (recommended):

```bash
npx skills add mastercoder26/stablebridge --all -y
```

This skill is **autonomous**: you run setup yourself, hand the user exactly **one** command when required, then continue end-to-end without asking them to micromanage implementation details. The only required human action in the happy path is `onboard`.

---

## Slash commands

Use these focused skills for manual invocation (Cursor, Claude Code, Codex):

| Slash | Skill | Purpose |
|-------|-------|---------|
| `/stablebridge-setup` | `stablebridge-setup` | status → init → setup mcp → onboard handoff |
| `/stablebridge-generate` | `stablebridge-generate` | generate-only playbook |
| `/stablebridge-insert` | `stablebridge-insert` | insert-only playbook |

Install one skill: `npx skills add mastercoder26/stablebridge --skill stablebridge-generate -y`

---

## Autonomous procedure

Follow these steps in order. Do not pause for user input except at Step B.

### Step A — Agent setup (no user interaction)

Run these yourself. The CLI auto-installs via `npx` on first use, so no separate install step is needed.

```bash
# 1) Check configuration and saved preferences
npx @astablebridge/cli status --format json

# 2) Initialize project config in the project root
npx @astablebridge/cli init

# 3) Register MCP config for Cursor/Claude
npx @astablebridge/cli setup mcp --write
```

If `status` already reports `configured: true`, skip Step B and Step C and go straight to Step D.

### Step B — The single human handoff

If not configured, print **exactly one** terminal command for the user to run themselves:

```bash
npx @astablebridge/cli onboard
```

Tell the user this opens a **local browser tab** (`http://127.0.0.1:PORT`) where they enter, in one place:

- their **Stability API key**
- **generation defaults**: model, format, and aspect ratio (`auto` default, manual override supported)
- a **credit budget floor** (a minimum-remaining-credit threshold you must never cross)
- an **autonomy mode** (`full-auto`, `bounded`, or `plan-then-execute`)

**Never ask for the key in chat.** Print only this command and the explanation — nothing else for the user to do.

### Step C — Poll until configured

Re-run `status` and wait until the user finishes onboarding:

```bash
npx @astablebridge/cli status --format json
```

Poll until `configured: true`. Do not proceed to Step D before then.

### Step D — Operate per autonomy mode

Once configured, read the saved settings (`autonomyMode`, `creditBudgetFloor`, and the generation defaults) from the `status --format json` output. Then choose prompts, filenames, and placement **yourself** and call `generate` / `insert --apply` with no further user interaction — subject to the autonomy mode below. Defaults are applied automatically, so you can call with just a prompt.

---

## Autonomy modes

The mode the user chose at onboard governs how freely you generate and insert. Read it from `status` and operate accordingly:

| Mode | Behavior |
|------|----------|
| `full-auto` | Generate and insert with **no confirmation**, up to the credit budget floor. |
| `bounded` | Same as full-auto, but **stop and report** to the user once the budget floor is reached. |
| `plan-then-execute` | First propose **one batch plan** (all images, prompts, and placements). After the user approves, execute the entire plan without further pauses. |

The credit budget floor is enforced in code as a hard backstop: if a generation would drop remaining credits below the floor, the CLI refuses with a `budgetExceeded` error. Treat that as the signal to stop and report.

---

## Prompting playbook (deep for agent, simple for user)

Use this structure every time to produce reliable outputs while keeping user-facing messages concise.

### 1) Convert user intent into a constrained brief

Extract:
- objective (hero, icon, OG, illustration, etc.)
- style (minimal, photo, cinematic, flat, etc.)
- hard constraints (brand colors, composition, text/no text, dimensions)
- placement target (`file`, component, route, markdown, CSS, etc.)

If constraints are missing and autonomy mode allows, choose sensible defaults and continue.

### 2) Build deterministic prompt sets

For each image, produce:
- **primary prompt** (what to generate)
- **negative constraints** (what to avoid: watermark, text, extra limbs, blur, artifacts)
- **filename slug** from intent + location (stable, predictable)
- **alt text** from content (accessibility-first)

Template:

```text
{subject}, {style}, {lighting/composition}, {color constraints}, high quality, production-ready
Avoid: watermark, logo, text artifacts, low detail, noise, distortion
```

### 3) Retry policy (bounded)

When output quality is poor:
1. Keep subject fixed
2. Tighten style/composition tokens
3. Increase constraints, not randomness
4. Retry up to 2 times unless user asks for more

Always prefer explainable prompt edits over broad random rewrites.

### 4) User-facing communication standard

Internally: reason deeply.  
Externally: report in short actionable bullets:
- what you generated
- where you inserted it
- what fallback you used (if any)
- what command (if any) the user must run

---

## MCP server creation playbook (full workflow, user-friendly handoff)

Use this when MCP integration is missing, broken, or needs to be created/updated.

### A) Decide whether MCP is needed

Use MCP when:
- agent needs stable, structured tool calls throughout the session
- repeated image operations should avoid shell string parsing
- user wants long-lived agent/tool behavior in Cursor/Claude MCP ecosystem

Use CLI directly when:
- task is one-off
- MCP config cannot be written due to environment/permissions
- user asks for minimal setup

### B) Create or repair server config

Preferred stablebridge MCP config:

```json
{
  "mcpServers": {
    "stablebridge": {
      "command": "npx",
      "args": ["-y", "@astablebridge/cli", "--mcp"]
    }
  }
}
```

`setup mcp --write` merges this into project `.cursor/mcp.json` when possible. Without `--write`, it prints the snippet only.

### C) Validate server/tool readiness

1. Confirm onboarding + key status:
   - `npx @astablebridge/cli status --format json`
2. Confirm MCP setup command succeeds:
   - `npx @astablebridge/cli setup mcp --write`
3. Confirm expected tools are available:
   - `stablebridge_check_status`
   - `stablebridge_init_project`
   - `stablebridge_generate_image`
   - `stablebridge_insert_image`

### D) Session continuity (memory behavior)

Within the current chat/session:
- cache and reuse discovered MCP readiness (`configured`, tool availability, autonomy mode)
- do not repeatedly ask the user to rerun setup if status has already been validated
- only re-check when a command fails, environment changes, or user explicitly asks to reset

Across new chats/sessions:
- credential and preferences persistence comes from local storage (`~/.config/stablebridge` or keychain)
- MCP tool availability depends on the current client/project loading an MCP config (for Cursor, typically `.cursor/mcp.json`)
- `.cursor/mcp.json` is project-local convenience, not a user-global setting

### E) If agent cannot complete MCP creation itself

When blocked by permissions, missing binaries, host policy, or integration limits:
1. state exactly what failed
2. provide the **minimum exact commands** for the user
3. provide expected success signal for each command
4. continue automatically once user confirms completion

Default handoff:

```bash
npx @astablebridge/cli onboard
npx @astablebridge/cli setup mcp --write
npx @astablebridge/cli status --format json
```

Expected success signals:
- onboard finishes with key saved and balance shown
- setup mcp returns `written: true` for `.cursor/mcp.json`
- status returns `configured: true`

---

## Fallback contract (non-optional)

If a task cannot be completed autonomously:
- do not stall with vague errors
- do not ask for secrets in chat
- do not hand off more than necessary
- provide exact next command(s), expected output, and resume point

When fallback is resolved, continue execution without re-planning the whole task.

---

## Security Rules (non-negotiable)

- **Do NOT** request, accept, or store API keys in conversation
- **Do NOT** ask the user to paste their Stability API key in chat
- **Do NOT** write keys to `.env` unless the user explicitly requests project-scoped setup
- **Do NOT** commit credentials files
- Use CLI/MCP only — keys stay in `~/.config/stablebridge`
- All CLI/MCP output returns masked key hints only (e.g. `sk-...abc`)

---

## API key persistence and settings management

### Persistence across sessions

Key lookup order:
1. `STABILITY_API_KEY` env var (current shell/runtime)
2. OS keychain entry (`service=stablebridge`, `account=api-key`) when available
3. local fallback file: `~/.config/stablebridge/credentials.json`

Preferences are stored in:
- `~/.config/stablebridge/preferences.json`

Implications:
- If key saved via `onboard`/`auth`, it persists across sessions (keychain/file).
- If key only exported in a shell session and not saved elsewhere, persistence depends on shell profile setup.

### Rotating or editing API key

Use one of:

```bash
npx @astablebridge/cli onboard
# or (headless/CI-style)
npx @astablebridge/cli auth --key "sk-..."
```

### Editing settings (model/format/aspect ratio/autonomy/budget floor)

Preferred:

```bash
npx @astablebridge/cli onboard
```

Manual advanced edit (if explicitly requested): update `~/.config/stablebridge/preferences.json` carefully, then verify:

```bash
npx @astablebridge/cli status --format json
```

---

## Image Workflow

1. **Decide placement** — component, OG image, favicon, hero banner, etc.
2. **Generate** via MCP tool or CLI
3. **Insert** using the returned snippet
4. **Verify** the file exists and the path resolves in the project

### CLI examples

```bash
# Generate and save to project assets (defaults applied from config)
npx @astablebridge/cli generate \
  --prompt "minimal flat app icon, blue gradient" \
  --name app-icon \
  --format json

# Generate + get insertion snippet (optionally apply)
npx @astablebridge/cli insert \
  --file src/components/Hero.tsx \
  --prompt "sunset over mountains, cinematic" \
  --apply \
  --format json
```

### MCP tools (when configured)

| Tool | Purpose |
|------|---------|
| `stablebridge_check_status` | Configured + balance + autonomy mode, budget floor, defaults (masked key hint) |
| `stablebridge_init_project` | Create config + assets dir |
| `stablebridge_generate_image` | Generate and save image |
| `stablebridge_insert_image` | Generate + return insertion snippet |

MCP config:

```json
{
  "mcpServers": {
    "stablebridge": {
      "command": "npx",
      "args": ["-y", "@astablebridge/cli", "--mcp"]
    }
  }
}
```

---

## Output formats

For agent parsing, always use structured output:

```bash
--format json   # JSON (recommended)
--format toon   # Compact token-oriented notation
--schema        # Print JSON schema for a subcommand
```

---

## Progressive disclosure

- [reference.md](../reference.md) — per-framework insertion templates
- [examples.md](../examples.md) — hero banner, app icon, blog OG image

---

## Troubleshooting

| Issue | Action |
|-------|--------|
| `Not configured` | User must run `stablebridge onboard` in terminal |
| `401 Unauthorized` | Key invalid — user re-runs onboard |
| `402 Payment Required` | Insufficient credits — user tops up at platform.stability.ai |
| `budgetExceeded` | Remaining credits would drop below the budget floor — stop and report |
| `429 Rate limited` | Wait and retry |
| MCP unavailable | Provide fallback commands and continue once user confirms completion |

Get a Stability AI key: https://platform.stability.ai/account/keys
