---
name: stablebridge-insert
description: Generate and insert Stability AI images into project files with stablebridge. Use when the user invokes /stablebridge-insert or asks to place images in code.
disable-model-invocation: true
---

# stablebridge Insert

**Slash:** `/stablebridge-insert` — generate + insert into a target file. API key never enters chat.

Install: `npx skills add mastercoder26/stablebridge --skill stablebridge-insert -y`

---

## Prerequisites

```bash
npx @astablebridge/cli status --format json
```

If not configured, run `/stablebridge-setup` or hand off `npx @astablebridge/cli onboard` only.

---

## Insert via CLI

```bash
npx @astablebridge/cli insert \
  --file src/components/Hero.tsx \
  --prompt "sunset over mountains, cinematic" \
  --apply \
  --format json
```

Options: `--framework`, `--alt`, `--placeholder`, `--name`, `--model`, `--format-image`, `--aspect-ratio`.

Without `--apply`, use the returned snippet manually.

---

## Insert via MCP

When MCP is configured:

- Tool: `stablebridge_insert_image`
- Provide target file path, prompt, and optional framework/alt
- Use `stablebridge_check_status` if configuration is unknown

---

## Framework snippets

See [reference.md](../reference.md) for Next.js, React, HTML, Markdown, and CSS templates.

---

## Autonomy

Read `autonomyMode` from status:
- `full-auto` / `bounded`: insert without extra confirmation (bounded stops at budget floor)
- `plan-then-execute`: propose placement plan first, then execute after approval

---

## Security

- Never ask for API keys in chat
- Do not commit generated assets paths that expose secrets (there are none in images)
