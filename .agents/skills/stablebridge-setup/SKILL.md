---
name: stablebridge-setup
description: Run stablebridge setup only — status, init, MCP config, and onboard handoff. Use when the user invokes /stablebridge-setup or asks to configure stablebridge.
disable-model-invocation: true
---

# stablebridge Setup

**Slash:** `/stablebridge-setup` — manual setup workflow. Your API key never enters chat.

Install: `npx skills add mastercoder26/stablebridge --skill stablebridge-setup -y`

Shared reference: [reference.md](../reference.md)

---

## Procedure (run in order)

### 1. Check status

```bash
npx @astablebridge/cli status --format json
```

If `configured: true`, report readiness (key hint, balance, autonomy mode) and stop unless the user asked to reconfigure.

### 2. Initialize project

```bash
npx @astablebridge/cli init
```

### 3. MCP config

```bash
npx @astablebridge/cli setup mcp --write
```

Use `--dry-run` first if you need to preview without writing. For non-Cursor environments, print the snippet from `setup mcp` without `--write`.

### 4. Onboard handoff (only if not configured)

Print **exactly one** command:

```bash
npx @astablebridge/cli onboard
```

Never ask for the API key in chat.

### 5. Poll until ready

```bash
npx @astablebridge/cli status --format json
```

Proceed only when `configured: true`.

---

## Security

- Do not request or accept API keys in conversation
- Do not commit credentials files
- Keys live in `~/.config/stablebridge` only

---

## Install all skills

```bash
npx skills add mastercoder26/stablebridge --all -y
```
